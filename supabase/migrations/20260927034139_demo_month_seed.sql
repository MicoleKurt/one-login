create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Accounts that get a realistic month of plumbing-business data.
create table private.demo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Idempotent: seeds each demo account once per calendar month (business tz),
-- spreading entries across the days elapsed so far. The demo starts $386 in
-- the red on purpose - one "Job done" flips it into the black.
create or replace function private.seed_demo_month(tz text default 'Australia/Sydney')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  start_ts     timestamptz := (date_trunc('month', now() at time zone tz)) at time zone tz;
  days_elapsed int := greatest(1, extract(day from now() at time zone tz)::int);
  acct         record;
  item         jsonb;
  i            int;
  candidate    timestamptz;
  jobs_seed constant jsonb := '[
    {"c":"Rossi","d":"Roof leak + gutter","amt":560,"at":0.02,"h":9},
    {"c":"O''Brien","d":"Leaking tap + cistern","amt":290,"at":0.08,"h":11},
    {"c":"Mitchell","d":"Bathroom rough-in","amt":3600,"at":0.15,"h":15},
    {"c":"Patel","d":"Blocked drain","amt":385,"at":0.22,"h":10},
    {"c":"Sunrise Cafe","d":"Grease trap service","amt":520,"at":0.30,"h":7},
    {"c":"Kowalski","d":"Gas cooktop install","amt":680,"at":0.38,"h":13},
    {"c":"Harbourview Strata","d":"Burst pipe, level 3","amt":1920,"at":0.45,"h":16},
    {"c":"Williams","d":"Hot water service","amt":260,"at":0.52,"h":9},
    {"c":"Brennan Builders","d":"New build fit-off","amt":2880,"at":0.60,"h":15},
    {"c":"Chen","d":"Kitchen mixer swap","amt":330,"at":0.68,"h":11},
    {"c":"Tran","d":"Blocked drain","amt":340,"at":0.76,"h":14},
    {"c":"Evans","d":"Outdoor tap + garden line","amt":410,"at":0.84,"h":10},
    {"c":"Lee","d":"Emergency call-out","amt":495,"at":0.92,"h":19},
    {"c":"Nguyen","d":"Hot water system","amt":2450,"at":1.00,"h":8}
  ]';
  costs_seed constant jsonb := '[
    {"p":"Harbour Industrial","c":"Workshop rent","amt":1650,"at":0.00,"h":6},
    {"p":"Toyota Finance","c":"Van lease","amt":1180,"at":0.03,"h":6},
    {"p":"Software subs (6 apps)","c":"Software","amt":389,"at":0.05,"h":3},
    {"p":"Reece Plumbing","c":"Materials","amt":2318,"at":0.12,"h":7},
    {"p":"Ampol","c":"Fuel","amt":862,"at":0.20,"h":17},
    {"p":"Jake Morris","c":"Apprentice wages","amt":1960,"at":0.35,"h":5},
    {"p":"Tradelink","c":"Materials","amt":1146,"at":0.40,"h":7},
    {"p":"CGU","c":"Public liability","amt":390,"at":0.45,"h":4},
    {"p":"Kennards Hire","c":"Jetter hire","amt":310,"at":0.55,"h":8},
    {"p":"Bunnings","c":"Tools + consumables","amt":486,"at":0.62,"h":16},
    {"p":"Total Tools","c":"Press tool","amt":1580,"at":0.70,"h":12},
    {"p":"Telstra","c":"Phone + data","amt":145,"at":0.78,"h":3},
    {"p":"Jake Morris","c":"Apprentice wages","amt":1960,"at":0.85,"h":5},
    {"p":"Super fund","c":"Apprentice super","amt":470,"at":0.86,"h":5},
    {"p":"Bookkeeper","c":"Admin","amt":660,"at":0.90,"h":9}
  ]';
begin
  for acct in select user_id from private.demo_accounts loop
    continue when exists (
      select 1 from public.costs c where c.user_id = acct.user_id and c.spent_at >= start_ts
    );

    i := 0;
    for item in select value from jsonb_array_elements(jobs_seed) loop
      candidate := start_ts + make_interval(
        days  => floor((item->>'at')::numeric * (days_elapsed - 1))::int,
        hours => (item->>'h')::int);
      insert into public.jobs (user_id, customer, description, amount_cents, done_at)
      values (acct.user_id, item->>'c', item->>'d', (item->>'amt')::bigint * 100,
              greatest(start_ts + make_interval(mins => i + 1),
                       least(candidate, now() - make_interval(mins => 5 + i * 7))));
      i := i + 1;
    end loop;

    i := 0;
    for item in select value from jsonb_array_elements(costs_seed) loop
      candidate := start_ts + make_interval(
        days  => floor((item->>'at')::numeric * (days_elapsed - 1))::int,
        hours => (item->>'h')::int);
      insert into public.costs (user_id, payee, category, amount_cents, spent_at)
      values (acct.user_id, item->>'p', item->>'c', (item->>'amt')::bigint * 100,
              greatest(start_ts + make_interval(mins => i + 1),
                       least(candidate, now() - make_interval(mins => 6 + i * 7))));
      i := i + 1;
    end loop;
  end loop;
end;
$$;

revoke execute on function private.seed_demo_month(text) from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- 14:30 UTC = 00:30 AEST / 01:30 AEDT. Only does work on the first run of a month.
select cron.schedule('seed-demo-month', '30 14 * * *', $$select private.seed_demo_month()$$);
