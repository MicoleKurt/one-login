import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase/cookies";

const SIGNED_OUT_PAGES = ["/login", "/signup"];
const SECOND_STEP_PAGE = "/mfa";

/**
 * The front door. Every page request:
 *  1. gets a fresh CSP nonce, so only our own scripts can run;
 *  2. has its Supabase session refreshed and checked;
 *  3. is routed to the one place it's allowed to be:
 *     signed out -> /login, password only -> /mfa, fully verified -> the money screen.
 * The database enforces the same rules again with RLS - this is the first wall, not the only one.
 */
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };

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

  const result = destination ? redirectWithCookies(request, response, destination) : response;
  result.headers.set("Content-Security-Policy", csp);
  return result;
}

function contentSecurityPolicy(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const realtime = supabase.replace("https://", "wss://");
  const dev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes power the animations; scripts stay nonce-locked.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${realtime} https://api.pwnedpasswords.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
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
