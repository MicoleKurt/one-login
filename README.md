# One Login

**One login. One screen. Are we in the black this month?**

A mini "One Login" app for tradies, built for Site VIP & Angus Shield. You sign in once and get one screen with this month's money in, money out, and profit. The profit is huge and green in the black, red if not. One button, **Job done**, adds a job, and the money updates straight away.

**Live:** https://one-login-sitevip.vercel.app

| Demo login |                           |
| ---------- | ------------------------- |
| Email      | `kristopher@onelogin.app` |
| Password   | `outsimple`               |

Or tap **Try the demo** on the login screen. There's no signup, just one tap.

---

## The 30-second test

1. Open the link on your phone. Tap **Try the demo**.
2. You're **$386 in the red**, and the screen says so in red.
3. Tap **Job done**. Customer, job, price. Tap **Add**.
4. The numbers count up, the screen turns green, and you're back in the black.

That's the whole app, and you don't need instructions for it.

## What's in it

- **One screen.** Profit is the hero. Money in and money out sit under it, then a "costs covered" bar, then the month's feed. When you scroll, profit moves into the top bar, so it never leaves the screen.
- **Job done in three fields.** Chips show recent customers and jobs, so a repeat customer is one tap. "Same as last time" fills in the price you charged for that job before. The Return key moves to the next field, and the keyboard opens on the first tap, including on iPhone.
- **Instant.** Updates are optimistic, so the number moves before the server replies, and there's a 6-second **Undo**.
- **Works with one bar of signal.** No reception on site? The job saves on the phone and syncs itself when you're back online.
- **Live across devices.** Log a job on your phone and it appears on the office laptop through Supabase Realtime.
- **The flip.** Crossing from red into the black fires a small celebration, plus haptics on Android.
- **Premium but calm.** Parallax depth layers follow tilt and scroll, numbers count up, the page mood shifts from green to red, and a film grain sits over it all. Everything is GPU-only transforms and honours `prefers-reduced-motion`.
- **Installable.** Add it to your home screen as a PWA and it opens full-screen.

## What I left out, on purpose

| Left out                                | Why                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typing in expenses                      | Money out should come from the **bank feed**, not the tradie's thumbs. Here it's shown as a live bank feed, and the real thing is CDR bank feeds. |
| Menus, tabs, settings                   | There's one screen, so there's nothing to navigate.                                                                                               |
| Sign-up and onboarding                  | Accounts get provisioned with the business (or you use the demo). Every screen you add before the numbers is a place people drop off.             |
| Invoice numbers, GST fields, categories | They're needed for BAS, but the software should work them out, not ask the tradie.                                                                |
| Charts and reports                      | One number answers the question. The bar under it answers "how close am I?"                                                                       |
| Editing a job                           | Undo covers 95% of mistakes. Editing is a later feature, not a day-one one.                                                                       |

## How it's built

- **Next.js 16** (App Router, Server Actions, `proxy.ts` for session refresh and route guarding)
- **Supabase**: Postgres, Auth, Realtime. The project runs in **Sydney (ap-southeast-2)** and the Vercel functions are pinned to **syd1**, so data stays onshore. Onshore hosting is the default under the ATO's DSP Operational Framework.
- **Row Level Security** on every table: you can only read, add, or delete your own jobs. Costs are read-only to the client because the bank feed writes them.
- **One round trip** per screen: the `dashboard()` RPC returns the month's jobs and costs. Month boundaries are worked out in `Australia/Sydney`, not UTC.
- **Motion** for animation and **Tailwind v4** for styling. There's no UI kit.
- The **demo data rolls forward** by itself: a `pg_cron` job seeds a realistic month for the demo account on the first night of each month.

```
src/
  app/                 login, dashboard page, server actions, icons, manifest
  components/
    dashboard/         hero, feed, job sheet, toast, celebration, data hook
    login/             login screen with floating parallax cards
    ui/                backdrop (parallax planes), tilt hook, logo
  lib/                 money formatting, Supabase clients
  proxy.ts             session refresh + redirects
supabase/migrations/   schema, RLS, dashboard RPC, demo seeding
```

## Run it locally

```bash
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm install
npm run dev
```

Apply `supabase/migrations/*` to your project. To set up a demo account, create a user in Supabase Auth, then run:

```sql
insert into private.demo_accounts (user_id) values ('<user id>');
select private.seed_demo_month();
```

---

Built by Micole Kurt "Ico" Gonda · [ico-portfolio.vercel.app](https://ico-portfolio.vercel.app/)
