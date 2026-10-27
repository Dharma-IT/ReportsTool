import { databaseQuery } from './aircall-ledger-admin.mjs'

await databaseQuery(`begin;
do $$
declare v_week date := date_trunc('week',timestamp '2099-01-01')::date; v_data jsonb;
begin
  perform public.merge_weekly_report_fields(v_week,'{"version":8,"hubSpot":{"revenue":100}}');
  perform public.merge_weekly_report_fields(v_week,'{"doxy":{"sales":[{"name":"Test seller","doxySeconds":10}]}}');
  perform public.merge_weekly_report_fields(v_week,'{"doxy":{"cs":[{"name":"Test CS","doxySeconds":20}]}}');
  v_data := public.merge_weekly_report_fields(v_week,'{"version":8,"hubSpot":{"revenue":200}}');
  if v_data->'doxy'->'sales'->0->>'doxySeconds'<>'10' or v_data->'doxy'->'cs'->0->>'doxySeconds'<>'20' then raise exception 'HubSpot refresh lost a Doxy upload'; end if;
  v_data := public.merge_weekly_report_fields(v_week,'{"doxy":{"sales":[{"name":"Test seller","doxySeconds":30}]}}');
  if v_data->'hubSpot'->>'revenue'<>'200' or v_data->'doxy'->'cs'->0->>'doxySeconds'<>'20' or v_data->'doxy'->'sales'->0->>'doxySeconds'<>'30' then raise exception 'Team upload replaced another team or financial fields'; end if;
end $$;
rollback;`)
console.log('Atomic weekly refresh/upload database tests passed; test rows rolled back.')
