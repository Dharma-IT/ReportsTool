create table if not exists public.daily_reports (
  team text not null check (team in ('cs', 'sales')),
  from_date date not null,
  to_date date not null,
  timezone text not null default 'America/New_York',
  report_data jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team, from_date, to_date),
  constraint daily_reports_valid_range check (from_date <= to_date),
  constraint daily_reports_data_is_object check (jsonb_typeof(report_data) = 'object')
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at
before update on public.daily_reports
for each row
execute function public.set_updated_at();

alter table public.daily_reports enable row level security;

drop policy if exists "Allow anon insert daily reports" on public.daily_reports;
create policy "Allow anon insert daily reports"
on public.daily_reports
for insert
to anon
with check (true);

-- Reads and updates remain server-only through the Supabase service-role key.
