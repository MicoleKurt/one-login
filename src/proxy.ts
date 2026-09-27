import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase/cookies";

const SIGNED_OUT_PAGES = ["/login", "/signup"];
const SECOND_STEP_PAGE = "/mfa";

/**
 * The front door. Every page request:
 *  1. has its Supabase session refreshed and checked;
 *  2. is routed to the one place it's allowed to be:
 *     signed out -> /login, password only -> /mfa, fully verified -> the money screen.
 * The database enforces the same rules again with RLS - this is the first wall, not the only one.
 */
export async function proxy(request: NextRequest) {
  const forward = () => NextResponse.next({ request });

  let response = forward();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims() verifies the JWT signature - a forged or tampered token reads as signed out.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;

  let destination: string | null = null;
  if (!claims) {
    if (!SIGNED_OUT_PAGES.includes(path)) destination = "/login";
  } else if (claims.aal !== "aal2") {
    if (path !== SECOND_STEP_PAGE) destination = SECOND_STEP_PAGE;
  } else if (SIGNED_OUT_PAGES.includes(path) || path === SECOND_STEP_PAGE) {
    destination = "/";
  }

  return destination ? redirectWithCookies(request, response, destination) : response;
}

function redirectWithCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Prefetches go through the same checks - no request skips the front door.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|opengraph-image|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
