alter table public.migration_todo_items add column if not exists parent_id uuid references public.migration_todo_items(id);
create index if not exists migration_todo_parent on public.migration_todo_items(parent_id);
insert into public.migration_todo_items(id,title,parent_id)
select md5('migration-checklist-child-' || parent_id || '-' || title)::uuid,title,parent_id::uuid
from (values
 ('c072b124-670a-4000-8000-000000000006','Campaign'),
 ('c072b124-670a-4000-8000-000000000006','Finance Report'),
 ('c072b124-670a-4000-8000-000000000006','Missed Calls'),
 ('c072b124-670a-4000-8000-000000000006','Customer Care'),
 ('c072b124-670a-4000-8000-000000000006','Daily'),
 ('c072b124-670a-4000-8000-000000000006','Weekly'),
 ('c072b124-670a-4000-8000-000000000006','Refunds'),
 ('c072b124-670a-4000-8000-000000000006','Appointment Reports'),
 ('c072b124-670a-4000-8000-000000000006','AC Automation'),
 ('c072b124-670a-4000-8000-000000000006','Supplements'),
 ('c072b124-670a-4000-8000-000000000006','Checker'),
 ('c072b124-670a-4000-8000-000000000005','Sellers workflow'),
 ('c072b124-670a-4000-8000-000000000005','CS workflow'),
 ('c072b124-670a-4000-8000-000000000005','Nutri workflow'),
 ('c072b124-670a-4000-8000-000000000003','Schedule for Sellers Form'),
 ('c072b124-670a-4000-8000-000000000003','Nutri Form'),
 ('c072b124-670a-4000-8000-000000000003','CS Form')
) as seeds(parent_id,title)
on conflict(id) do nothing;
notify pgrst,'reload schema';
