import type { CookieOptionsWithName } from "@supabase/ssr";

/** Sessions live 30 days on a device (Supabase's default is 400), HTTPS-only in production. */
export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};
