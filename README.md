# One Login

**One login. One screen. Are we in the black this month?**

A mini "One Login" app for tradies, built for Site VIP & Angus Shield. You sign in once and see one screen: this month's money in, money out and profit. It's huge and green when you're in the black, and red when you're not. One button, **Job done**, logs a job and the money updates instantly.

**Live:** https://one-login-sitevip.vercel.app

Create an account, set up two-step verification (about 30 seconds with any authenticator app), and tap **Load a sample month** to see it with realistic numbers. Then tap **Job done**.

> Round 2 is about keeping it safe. The security model is written up in [SECURITY.md](SECURITY.md), and [`scripts/attack-test.mjs`](scripts/attack-test.mjs) runs 36 real attacks against the live API. All 36 are blocked.

---

## Security at a glance

| Guarantee                                    | How it's enforced                                                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Passwords are never stored in plain text** | Supabase Auth stores bcrypt hashes. Passwords go straight from the browser to Supabase Auth, so our server never sees one.                                           |
| **Business A never sees business B**         | Postgres Row Level Security on every table, tied to the caller's membership. A trigger stamps `business_id`, and clients aren't allowed to write that column at all. |
| **A stolen password isn't enough**           | Two-step verification (TOTP) is mandatory. The database returns no money rows unless the session has passed it (`aal2`).                                             |
| **Money records can't be quietly changed**   | Jobs are never updated or deleted. Undo is a void: allowed only for the person who logged the job, within 15 minutes, and it's logged.                               |
| **Every change is on the record**            | An append-only audit log (who, what, when, IP). Updates and deletes are blocked even for the database owner.                                                         |
| **Least privilege**                          | Anonymous visitors have zero table access. Signed-in users have column-level grants: they can insert 5 job columns and update 1.                                     |
| **Browser hardening**                        | A per-request nonce CSP, HSTS, `frame-ancestors 'none'`, nosniff, a strict referrer policy and a locked-down Permissions-Policy.                                     |
| **Onshore data**                             | Supabase in Sydney (ap-southeast-2) and Vercel functions pinned to `syd1`.                                                                                           |

## What's in the app

- **Real accounts:** sign up (name, business, email, password), sign in, and two-step verification. Passwords must be 12+ characters with no personal details, and are checked against 900M+ breached passwords via Have I Been Pwned. Only the first 5 characters of a hash ever leave the device.
- **One screen:** profit is the hero, with money in and money out under it, a "costs covered" bar, and the month's feed. Scroll down and profit moves into the top bar, so it never leaves the screen.
- **Job done:** customer, job, price. Repeat customers are one tap, and "same as last time" fills in the price.
- **Instant, offline-first, live:** optimistic updates, a 6-second Undo, jobs saved on the phone when there's no signal, and realtime sync across a business's devices.
- **Account menu:** shows your two-step status, and lets you sign out of this device or out of **all devices**. Signing out wipes anything cached on the phone.

## What I left out, on purpose

| Left out                      | Why                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The one-tap shared demo login | Its password was in this public README. A shared credential is exactly what I'd flag in anyone's review, so it's gone and the account is deleted. |
| Password reset by email       | This needs a verified sending domain (Resend/Postmark). It's the next thing to add, not something to fake.                                        |
| Typing in expenses            | Money out should come from the **bank feed**, not the tradie's thumbs.                                                                            |
| Editing a job                 | Financial records shouldn't be rewritten. You void and re-enter, and both steps stay in the audit trail.                                          |
| Menus, tabs, settings, charts | There's one screen, so there's nothing to navigate.                                                                                               |

## How it's built

- **Next.js 16:** App Router, a `proxy.ts` front door that handles session refresh, 2-step routing and the CSP nonce, plus Server Actions for sign-out.
- **Supabase:** Postgres, Auth with TOTP MFA, and Realtime. RLS policies and triggers live in [`supabase/migrations`](supabase/migrations).
- **Motion** for animation and **Tailwind v4** for styling.

```
src/
  app/                 dashboard page, /login, /signup, /mfa, server actions
  components/
    auth/              sign in, sign up, two-step forms + the parallax shell
    dashboard/         hero, feed, job sheet, toast, realtime + offline data hook
    ui/                parallax backdrop, tilt hook, logo
  lib/                 money formatting, password rules, Supabase clients
  proxy.ts             the front door: session, 2-step routing, CSP
supabase/migrations/   schema, RLS, triggers, audit log
scripts/attack-test.mjs  36 attacks against the live API
```

## Run it locally

```bash
cp .env.example .env.local   # Supabase URL + publishable key
npm install
npm run dev
```

Apply `supabase/migrations/*` to your project. To run the attack suite, create two confirmed test accounts in two different businesses, then:

```bash
ATTACK_A_EMAIL=a@example.com ATTACK_B_EMAIL=b@example.com ATTACK_PASSWORD=... \
  node --env-file=.env.local scripts/attack-test.mjs
```

---

Built by Micole Kurt "Ico" Gonda · [ico-portfolio.vercel.app](https://ico-portfolio.vercel.app/)
