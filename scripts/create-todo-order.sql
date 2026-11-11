alter table public.migration_todo_items add column if not exists sort_order bigint;
with ranked as (select id, row_number() over (order by created_at, id) as position from public.migration_todo_items)
update public.migration_todo_items t set sort_order = ranked.position from ranked where t.id = ranked.id and t.sort_order is null;
create or replace function public.assign_migration_todo_order() returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(71823491);
  new.sort_order := (select coalesce(max(sort_order),0)+1 from public.migration_todo_items);
  return new;
end;
$$;
drop trigger if exists migration_todo_order_insert on public.migration_todo_items;
create trigger migration_todo_order_insert before insert on public.migration_todo_items for each row execute function public.assign_migration_todo_order();
create or replace function public.move_migration_todo(p_id uuid, p_target uuid, p_after boolean) returns void language plpgsql set search_path = public as $$
declare ordered_ids uuid[]; target_index integer;
begin
  perform pg_advisory_xact_lock(71823491);
  if p_id = p_target then return; end if;
  if not exists(select 1 from public.migration_todo_items where id=p_id) then raise exception 'Item not found'; end if;
  select array_agg(id order by sort_order,created_at,id) into ordered_ids from public.migration_todo_items where id<>p_id;
  target_index := array_position(ordered_ids,p_target);
  if target_index is null then raise exception 'Target not found'; end if;
  if not p_after then target_index := target_index-1; end if;
  ordered_ids := coalesce(ordered_ids[1:target_index],array[]::uuid[]) || array[p_id] || coalesce(ordered_ids[target_index+1:cardinality(ordered_ids)],array[]::uuid[]);
  update public.migration_todo_items t set sort_order=x.position, updated_at=now() from unnest(ordered_ids) with ordinality x(id,position) where t.id=x.id;
end;
$$;
revoke all on function public.move_migration_todo(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.move_migration_todo(uuid,uuid,boolean) to service_role;
notify pgrst,'reload schema';
