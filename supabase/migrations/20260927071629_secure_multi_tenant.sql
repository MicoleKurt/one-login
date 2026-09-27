-- =====================================================================
-- Round 2: real accounts, strict business isolation, data gated behind
-- two-step verification, immutable money records, append-only audit.
-- =====================================================================

-- 0. Retire the round-1 demo: its password was published in the README.
select cron.unschedule('seed-demo-month');
delete from auth.users where email = 'kristopher@onelogin.app';
drop function if exists private.seed_demo_month(text);
drop table if exists private.demo_accounts;
drop schema if exists private;
drop function if exists public.dashboard(text);
drop table if exists public.jobs;
drop table if exists public.costs;

-- 1. Nothing new is reachable by default. Every grant below is deliberate.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

create schema app;    -- helpers used by RLS; not exposed through the Data API
create schema audit;  -- append-only audit trail; no client access at all
revoke all on schema app, audit from public, anon, authenticated;
grant usage on schema app to authenticated;

-- 2. Tenancy: every login belongs to exactly one business.
create table public.businesses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.memberships (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

create function app.current_business_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.business_id from public.memberships m where m.user_id = (select auth.uid())
$$;

-- Money is only visible once the session has passed two-step verification.
create function app.is_aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

revoke all on function app.current_business_id(), app.is_aal2() from public, anon;
grant execute on function app.current_business_id(), app.is_aal2() to authenticated;

-- 3. Money in (jobs) and money out (bank feed).
create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  created_by   uuid not null references auth.users (id),
  customer     text not null check (char_length(btrim(customer)) between 1 and 80),
  description  text not null default '' check (char_length(description) <= 120),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  done_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id)
);
create index jobs_business_done_at_idx on public.jobs (business_id, done_at desc);

create table public.costs (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  payee        text not null check (char_length(payee) <= 120),
  category     text not null default 'Other' check (char_length(category) <= 60),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  spent_at     timestamptz not null default now(),
  source       text not null default 'bank_feed' check (source in ('bank_feed', 'sample')),
  created_at   timestamptz not null default now()
);
create index costs_business_spent_at_idx on public.costs (business_id, spent_at desc);

-- The server decides who owns a row and when it was made - never the client.
create function app.stamp_job() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new; -- trusted backend work (no end-user session) keeps its values
  end if;
  if tg_op = 'INSERT' then
    new.business_id := app.current_business_id();
    new.created_by  := auth.uid();
    new.created_at  := now();
    new.voided_at   := null;
    new.voided_by   := null;
    new.done_at     := least(coalesce(new.done_at, now()), now());
  elsif old.voided_at is null and new.voided_at is not null then
    new.voided_at := now();
    new.voided_by := auth.uid();
  end if;
  return new;
end $$;
create trigger jobs_stamp before insert or update on public.jobs
  for each row execute function app.stamp_job();

-- 4. Signup creates the business and makes the new user its owner, whichever
--    way the account was created (app, API, dashboard).
create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  biz      uuid;
  biz_name text := left(nullif(btrim(regexp_replace(
                    coalesce(new.raw_user_meta_data ->> 'business_name', ''), '[[:cntrl:]]', '', 'g')), ''), 80);
begin
  insert into public.businesses (name) values (coalesce(biz_name, 'My business')) returning id into biz;
  insert into public.memberships (business_id, user_id, role) values (biz, new.id, 'owner');
  return new;
end $$;
revoke all on function app.handle_new_user(), app.stamp_job() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- 5. Append-only audit trail: who did what, when, from where.
create table audit.events (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  business_id uuid,
  actor       uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  ip          text,
  detail      jsonb not null default '{}'
);
alter table audit.events enable row level security;
create index events_business_at_idx on audit.events (business_id, at desc);

create function audit.record_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  headers  jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  act      text  := lower(tg_op);
begin
  if tg_op = 'UPDATE' and old_data ->> 'voided_at' is null and row_data ->> 'voided_at' is not null then
    act := 'void';
  end if;
  insert into audit.events (business_id, actor, action, entity, entity_id, ip, detail)
  values (
    coalesce((row_data ->> 'business_id')::uuid,
             case when tg_table_name = 'businesses' then (row_data ->> 'id')::uuid end),
    auth.uid(),
    act,
    tg_table_name,
    case when tg_table_name = 'memberships' then (row_data ->> 'user_id')::uuid
         else (row_data ->> 'id')::uuid end,
    coalesce(headers ->> 'cf-connecting-ip', split_part(headers ->> 'x-forwarded-for', ',', 1)),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', old_data, 'after', row_data) else row_data end
  );
  return null;
end $$;

create function audit.deny_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit.events is append-only' using errcode = '42501';
end $$;

revoke all on function audit.record_change(), audit.deny_change() from public, anon, authenticated;

create trigger events_append_only before update or delete on audit.events
  for each row execute function audit.deny_change();
create trigger events_no_truncate before truncate on audit.events
  for each statement execute function audit.deny_change();

create trigger audit_businesses  after insert or update or delete on public.businesses  for each row execute function audit.record_change();
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function audit.record_change();
create trigger audit_jobs        after insert or update or delete on public.jobs        for each row execute function audit.record_change();
create trigger audit_costs       after insert or update or delete on public.costs       for each row execute function audit.record_change();

-- 6. Row Level Security: your business, and only once you've passed 2-step.
alter table public.businesses  enable row level security;
alter table public.memberships enable row level security;
alter table public.jobs        enable row level security;
alter table public.costs       enable row level security;

create policy "members read their own business" on public.businesses
  for select to authenticated
  using (id = (select app.current_business_id()) and (select app.is_aal2()));

create policy "members read their business's jobs" on public.jobs
  for select to authenticated
  using (business_id = (select app.current_business_id()) and (select app.is_aal2()));

create policy "members add jobs to their own business" on public.jobs
  for insert to authenticated
  with check (business_id = (select app.current_business_id())
              and created_by = (select auth.uid())
              and (select app.is_aal2()));

create policy "creators can void their own job within 15 minutes" on public.jobs
  for update to authenticated
  using (business_id = (select app.current_business_id())
         and created_by = (select auth.uid())
         and voided_at is null
         and created_at > now() - interval '15 minutes'
         and (select app.is_aal2()))
  with check (business_id = (select app.current_business_id()) and voided_at is not null);

create policy "members read their business's costs" on public.costs
  for select to authenticated
  using (business_id = (select app.current_business_id()) and (select app.is_aal2()));

-- memberships: deliberately no policies. Only app.current_business_id() reads it.

-- 7. Least privilege, down to the column.
revoke all on public.businesses, public.memberships, public.jobs, public.costs from anon, authenticated;
grant select on public.businesses to authenticated;
grant select on public.jobs to authenticated;
grant insert (id, customer, description, amount_cents, done_at) on public.jobs to authenticated;
grant update (voided_at) on public.jobs to authenticated;
grant select on public.costs to authenticated;

-- 8. The whole screen in one round trip. Security invoker: RLS does the filtering.
create function public.dashboard() returns json
language sql stable security invoker set search_path = '' as $$
  with bounds as (
    select (date_trunc('month', now() at time zone 'Australia/Sydney')) at time zone 'Australia/Sydney' as start
  )
  select json_build_object(
    'business', (select json_build_object('id', b.id, 'name', b.name) from public.businesses b limit 1),
    'month_start', (select start from bounds),
    'now', now(),
    'jobs', coalesce((
      select json_agg(json_build_object(
        'id', j.id, 'customer', j.customer, 'description', j.description,
        'amount_cents', j.amount_cents, 'done_at', j.done_at, 'created_at', j.created_at
      ) order by j.done_at desc)
      from public.jobs j, bounds
      where j.done_at >= bounds.start and j.voided_at is null
    ), '[]'::json),
    'costs', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'payee', c.payee, 'category', c.category,
        'amount_cents', c.amount_cents, 'spent_at', c.spent_at
      ) order by c.spent_at desc)
      from public.costs c, bounds
      where c.spent_at >= bounds.start
    ), '[]'::json)
  )
$$;

-- 9. "Load a sample month" - only ever into the caller's own business, once.
create function public.load_sample_month() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  biz          uuid := app.current_business_id();
  tz           constant text := 'Australia/Sydney';
  start_ts     timestamptz := (date_trunc('month', now() at time zone 'Australia/Sydney')) at time zone 'Australia/Sydney';
  days_elapsed int := greatest(1, extract(day from now() at time zone 'Australia/Sydney')::int);
  factor       numeric := 0.85 + random() * 0.3;
  gap_cents    bigint := (250 + floor(random() * 350))::bigint * 100;
  jobs_total   bigint := 0;
  costs_base   constant numeric := 15506;
  costs_target bigint;
  allocated    bigint := 0;
  item         jsonb;
  i            int := 0;
  n            int;
  amt          bigint;
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
    {"p":"Apprentice","c":"Wages","amt":1960,"at":0.35,"h":5},
    {"p":"Tradelink","c":"Materials","amt":1146,"at":0.40,"h":7},
    {"p":"CGU","c":"Public liability","amt":390,"at":0.45,"h":4},
    {"p":"Kennards Hire","c":"Jetter hire","amt":310,"at":0.55,"h":8},
    {"p":"Bunnings","c":"Tools + consumables","amt":486,"at":0.62,"h":16},
    {"p":"Total Tools","c":"Press tool","amt":1580,"at":0.70,"h":12},
    {"p":"Telstra","c":"Phone + data","amt":145,"at":0.78,"h":3},
    {"p":"Apprentice","c":"Wages","amt":1960,"at":0.85,"h":5},
    {"p":"Super fund","c":"Apprentice super","amt":470,"at":0.86,"h":5},
    {"p":"Bookkeeper","c":"Admin","amt":660,"at":0.90,"h":9}
  ]';
begin
  if biz is null or not app.is_aal2() then
    raise exception 'Two-step verification required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(biz::text));
  if exists (select 1 from public.costs c where c.business_id = biz) then
    return; -- a bank feed (or sample) already exists: never double up
  end if;

  for item in select value from jsonb_array_elements(jobs_seed) loop
    amt := round((item ->> 'amt')::numeric * factor)::bigint * 100;
    jobs_total := jobs_total + amt;
    candidate := start_ts + make_interval(
      days  => floor((item ->> 'at')::numeric * (days_elapsed - 1))::int,
      hours => (item ->> 'h')::int);
    insert into public.jobs (business_id, created_by, customer, description, amount_cents, done_at)
    values (biz, auth.uid(), item ->> 'c', item ->> 'd', amt,
            greatest(start_ts + make_interval(mins => i + 1),
                     least(candidate, now() - make_interval(mins => 5 + i * 7))));
    i := i + 1;
  end loop;

  -- Money out lands a few hundred dollars above money in: one good job away.
  costs_target := jobs_total + gap_cents;
  n := jsonb_array_length(costs_seed);
  i := 0;
  for item in select value from jsonb_array_elements(costs_seed) loop
    if i = n - 1 then
      amt := costs_target - allocated;
    else
      amt := round((item ->> 'amt')::numeric * costs_target / 100 / costs_base)::bigint * 100;
    end if;
    allocated := allocated + amt;
    candidate := start_ts + make_interval(
      days  => floor((item ->> 'at')::numeric * (days_elapsed - 1))::int,
      hours => (item ->> 'h')::int);
    insert into public.costs (business_id, payee, category, amount_cents, spent_at, source)
    values (biz, item ->> 'p', item ->> 'c', amt,
            greatest(start_ts + make_interval(mins => i + 1),
                     least(candidate, now() - make_interval(mins => 6 + i * 7))),
            'sample');
    i := i + 1;
  end loop;
end $$;

revoke all on function public.dashboard(), public.load_sample_month() from public, anon;
grant execute on function public.dashboard(), public.load_sample_month() to authenticated;

-- 10. Live updates across devices (RLS applies to every event).
alter publication supabase_realtime add table public.jobs;
