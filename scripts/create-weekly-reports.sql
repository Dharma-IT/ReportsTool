create table if not exists public.weekly_reports (
  week_start date primary key,
  week_end date not null,
  timezone text not null default 'America/New_York',
  report_data jsonb not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reports_valid_range check (week_end = week_start + 5),
  constraint weekly_reports_data_is_object check (jsonb_typeof(report_data) = 'object')
);

alter table public.weekly_reports drop constraint if exists weekly_reports_valid_range;
alter table public.weekly_reports add constraint weekly_reports_valid_range check (week_end = week_start + 5);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_weekly_reports_updated_at on public.weekly_reports;
create trigger set_weekly_reports_updated_at before update on public.weekly_reports
for each row execute function public.set_updated_at();

alter table public.weekly_reports enable row level security;
