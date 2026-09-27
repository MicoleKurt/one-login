# Security model

This app holds people's money. This page explains what protects it, where each protection lives in the code, and how it's tested.

## Threat model

| Attacker                       | What they have                                                       | What stops them                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anyone on the internet         | The public site, and the publishable API key (it's in every browser) | Anonymous visitors have **no** grants on any table or function, and the audit schema isn't exposed at all.                                                   |
| Another tradie on the platform | Their own valid login                                                | RLS scopes every read and write to the caller's business. `business_id` and `created_by` are stamped by the database, and clients can't write those columns. |
| Someone who stole a password   | Email + password                                                     | Mandatory TOTP. Without it the session is `aal1`, and every money policy requires `aal2`.                                                                    |
| A tampered or forged token     | An edited JWT                                                        | Signatures are verified by `getClaims()` in the proxy and by PostgREST. Edited tokens get HTTP 401.                                                          |
| An XSS or clickjacking attempt | Injected script or a framing page                                    | A nonce-based CSP (`script-src 'nonce-…' 'strict-dynamic'`), `frame-ancestors 'none'`, and React output escaping.                                            |
| Someone rewriting history      | A legitimate login                                                   | No UPDATE or DELETE on money. Voids are author-only and limited to 15 minutes. An append-only audit log records every change.                                |

## Where each control lives

- **Auth:** Supabase Auth with bcrypt-hashed passwords. Credentials go from the browser straight to Supabase, never through our server ([`login-form.tsx`](src/components/auth/login-form.tsx), [`signup-form.tsx`](src/components/auth/signup-form.tsx)).
- **Password policy:** 12+ characters, no name/business/email in it, a 72-byte bcrypt ceiling, and a Have I Been Pwned k-anonymity check ([`password.ts`](src/lib/password.ts)).
- **Two-step verification:** TOTP enrolment and challenge ([`mfa-form.tsx`](src/components/auth/mfa-form.tsx)). It's enforced in the database by `app.is_aal2()` inside every policy.
- **Routing:** [`proxy.ts`](src/proxy.ts) sends signed-out visitors to `/login` and password-only sessions to `/mfa`. Only fully verified sessions reach the money screen. Prefetches go through the same checks.
- **Tenant isolation, grants and audit:** [`20260927071629_secure_multi_tenant.sql`](supabase/migrations/20260927071629_secure_multi_tenant.sql).
- **Sessions:** 30-day Secure cookies (Supabase's default is 400 days). **Sign out of all devices** revokes every refresh token, and signing out clears cached data on the device.
- **Headers:** CSP in [`proxy.ts`](src/proxy.ts). HSTS, nosniff, X-Frame-Options, Referrer-Policy, COOP and Permissions-Policy in [`next.config.ts`](next.config.ts).
- **Data residency:** Supabase ap-southeast-2 (Sydney) and Vercel `syd1`.

## Proof

`scripts/attack-test.mjs` signs in as two real businesses through the public API and runs 36 attacks:

- anonymous reads and writes
- stolen-password (aal1) access
- cross-business reads, filters, inserts, author forgery and voids
- tampering with its own books (edit amount, move business, delete, un-void, double-load)
- a forged JWT
- realtime eavesdropping on another business's channel

Latest run: **36/36 blocked**. That includes control checks proving that legitimate actions still work.

## Known limits and next steps

- **Password reset and email verification** need a verified sending domain. Until then, email confirmation is off so testers can sign up.
- **Leaked-password protection at the Auth server** needs Supabase Pro. Until then, the HIBP check runs in the app.
- **CAPTCHA on signup** (Cloudflare Turnstile) comes before public launch. Supabase rate-limits sign-ups and sign-ins per IP in the meantime.
- **Independent penetration test** and ISO 27001 sit on the ATO accreditation path.

## Reporting a vulnerability

Email ico.webdev@gmail.com (also listed in [`/.well-known/security.txt`](public/.well-known/security.txt)). Please don't access data that isn't yours.
