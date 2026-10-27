-- Refresh HubSpot fields without replacing concurrent Weekly Doxy uploads.
create or replace function public.merge_weekly_report_fields(p_week_start date, p_fields jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_result jsonb;
begin
  if jsonb_typeof(p_fields)<>'object' then raise exception 'Weekly update must be an object'; end if;
  insert into public.weekly_reports(week_start,week_end,timezone,report_data,fetched_at)
  values(p_week_start,p_week_start+6,'America/New_York',p_fields,now())
  on conflict(week_start) do update set
    report_data=public.weekly_reports.report_data || excluded.report_data ||
      case when excluded.report_data ? 'doxy' then jsonb_build_object('doxy',coalesce(public.weekly_reports.report_data->'doxy','{}'::jsonb) || (excluded.report_data->'doxy')) else '{}'::jsonb end,
    fetched_at=now()
  returning report_data into v_result;
  return v_result;
end;
$$;
revoke all on function public.merge_weekly_report_fields(date,jsonb) from public,anon,authenticated;
grant execute on function public.merge_weekly_report_fields(date,jsonb) to service_role;
