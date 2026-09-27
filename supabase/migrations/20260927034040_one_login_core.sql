-- Money in: one row per finished job.
create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer     text not null check (char_length(btrim(customer)) between 1 and 80),
  description  text not null default '' check (char_length(description) <= 120),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  done_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index jobs_user_done_at_idx on public.jobs (user_id, done_at desc);

-- Money out: written by the bank feed, never typed by the tradie.
create table public.costs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  payee        text not null,
  category     text not null default 'Other',
  amount_cents bigint not null check (amount_cents > 0),
  spent_at     timestamptz not null default now(),
  source       text not null default 'bank_feed',
  created_at   timestamptz not null default now()
);
create index costs_user_spent_at_idx on public.costs (user_id, spent_at desc);

alter table public.jobs  enable row level security;
alter table public.costs enable row level security;

create policy "jobs are readable by their owner" on public.jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "jobs are insertable by their owner" on public.jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "jobs are deletable by their owner" on public.jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "costs are readable by their owner" on public.costs
  for select to authenticated using ((select auth.uid()) = user_id);

-- One round trip for the whole screen. Month boundaries are in the business's
-- timezone, not UTC, so "this month" flips at local midnight.
create or replace function public.dashboard(tz text default 'Australia/Sydney')
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('month', now() at time zone tz)) at time zone tz as start
  )
  select json_build_object(
    'month_start', (select start from bounds),
    'now', now(),
    'jobs', coalesce((
      select json_agg(json_build_object(
        'id', j.id, 'customer', j.customer, 'description', j.description,
        'amount_cents', j.amount_cents, 'done_at', j.done_at
      ) order by j.done_at desc)
      from public.jobs j, bounds b
      where j.done_at >= b.start
    ), '[]'::json),
    'costs', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'payee', c.payee, 'category', c.category,
        'amount_cents', c.amount_cents, 'spent_at', c.spent_at
      ) order by c.spent_at desc)
      from public.costs c, bounds b
      where c.spent_at >= b.start
    ), '[]'::json)
  )
$$;

revoke execute on function public.dashboard(text) from public, anon;
grant execute on function public.dashboard(text) to authenticated;

-- Live updates across devices.
alter publication supabase_realtime add table public.jobs;
