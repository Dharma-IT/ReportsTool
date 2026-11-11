create table if not exists public.migration_todo_items (
  id uuid primary key,
  title text not null check (length(btrim(title)) between 1 and 200),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.migration_todo_items enable row level security;
-- This shared checklist is accessed through the application's server API only.
revoke all on public.migration_todo_items from anon, authenticated;
grant select, insert, update on public.migration_todo_items to service_role;
insert into public.migration_todo_items (id, title, created_at) values
  ('c072b124-670a-4000-8000-000000000001', 'Contacts Migration', now()),
  ('c072b124-670a-4000-8000-000000000002', 'Deals Migration', now() + interval '1 millisecond'),
  ('c072b124-670a-4000-8000-000000000003', 'Forms', now() + interval '2 milliseconds'),
  ('c072b124-670a-4000-8000-000000000004', 'Calendar Connection', now() + interval '3 milliseconds'),
  ('c072b124-670a-4000-8000-000000000005', 'Workflows', now() + interval '4 milliseconds'),
  ('c072b124-670a-4000-8000-000000000006', 'Reports', now() + interval '5 milliseconds')
on conflict (id) do nothing;
notify pgrst, 'reload schema';
