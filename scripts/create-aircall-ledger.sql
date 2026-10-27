-- One permanent call record shared by Daily and Weekly. Raw webhook events remain intact.
set local lock_timeout = '2s';
create table if not exists public.aircall_reporting_calls (
  call_id bigint primary key,
  started_at bigint not null,
  answered_at bigint,
  ended_at bigint,
  agent_id bigint,
  agent_name text,
  raw_digits text not null default '',
  talk_seconds bigint not null default 0 check (talk_seconds >= 0),
  finalized boolean not null default false,
  source text not null check (source in ('api', 'webhook', 'export')),
  observed_at bigint not null,
  api_seen_at timestamptz,
  webhook_seen_at timestamptz,
  review_reason text,
  comparison_data jsonb,
  call_data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.aircall_reporting_calls add column if not exists raw_digits text;
alter table public.aircall_reporting_calls add column if not exists comparison_data jsonb;
create index if not exists aircall_reporting_calls_reporting_idx on public.aircall_reporting_calls (started_at, call_id);
create index if not exists aircall_call_events_timestamp_idx on public.aircall_call_events (event_timestamp, call_id);
alter table public.aircall_reporting_calls enable row level security;
revoke all on public.aircall_reporting_calls from anon, authenticated;
grant all on public.aircall_reporting_calls to service_role;

create table if not exists public.aircall_reporting_syncs (
  from_unix bigint not null,
  to_unix bigint not null,
  last_attempt timestamptz not null,
  last_success timestamptz,
  last_error text,
  primary key (from_unix,to_unix)
);
alter table public.aircall_reporting_syncs enable row level security;
revoke all on public.aircall_reporting_syncs from anon, authenticated;
grant all on public.aircall_reporting_syncs to service_role;

create or replace function public.ingest_aircall_reporting_call(p_call jsonb, p_source text, p_observed_at bigint, p_finalized boolean default true)
returns void language plpgsql set search_path = public as $$
declare
  v_id bigint; v_started bigint; v_answered bigint; v_ended bigint; v_talk bigint;
  v_agent bigint; v_name text; v_final boolean; v_old public.aircall_reporting_calls%rowtype;
  v_replace boolean; v_review text; v_data jsonb; v_comparison jsonb; v_agent_diff boolean;
  v_recipient jsonb; v_transfer_verified boolean := false; v_keep_identity boolean;
begin
  if p_source not in ('api', 'webhook', 'export') then raise exception 'Invalid Aircall source'; end if;
  v_id := nullif(p_call->>'id','')::bigint;
  v_started := nullif(p_call->>'started_at','')::bigint;
  if v_id is null or v_started is null then return; end if;
  v_answered := nullif(p_call->>'answered_at','')::bigint;
  v_ended := nullif(p_call->>'ended_at','')::bigint;
  v_agent := nullif(p_call->'user'->>'id','')::bigint;
  v_name := nullif(p_call->'user'->>'name','');
  v_final := p_finalized and v_ended is not null and v_ended >= v_started;
  if v_final and p_source<>'export' then
    select payload->'data'->'transferred_to' into v_recipient
    from public.aircall_call_events
    where call_id=v_id and event_type='call.transferred'
      and payload->'data'->'transferred_to'->>'id' is not null
    order by event_timestamp desc,event_key desc limit 1;
    if v_recipient is not null then
      if p_source='webhook' or (v_agent is null and v_name is null) then
        v_agent := (v_recipient->>'id')::bigint;
        v_name := v_recipient->>'name';
        p_call := jsonb_set(p_call,'{user}',v_recipient);
      end if;
      v_transfer_verified := v_agent=(v_recipient->>'id')::bigint;
    end if;
  end if;
  v_talk := case when p_source = 'export' and p_call ? 'talk_seconds'
    then greatest(0, (p_call->>'talk_seconds')::bigint)
    when v_final and v_answered is not null then greatest(0, v_ended-v_answered) else 0 end;
  v_data := p_call || jsonb_build_object('talk_seconds',v_talk);
  -- Serialize concurrent deliveries for the same call, including insert races.
  perform pg_advisory_xact_lock(v_id);
  select * into v_old from public.aircall_reporting_calls where call_id=v_id for update;
  if not found then
    insert into public.aircall_reporting_calls(call_id,started_at,answered_at,ended_at,agent_id,agent_name,raw_digits,talk_seconds,finalized,source,observed_at,api_seen_at,webhook_seen_at,call_data)
    values(v_id,v_started,v_answered,v_ended,v_agent,v_name,coalesce(p_call->>'raw_digits',''),v_talk,v_final,p_source,p_observed_at,
      case when p_source='api' then now() end,case when p_source='webhook' then now() end,v_data);
    return;
  end if;
  v_keep_identity := not v_final or v_old.finalized or v_old.answered_at is not null
    or p_call->>'direction'='outbound' or v_old.call_data->>'direction'='outbound';
  v_agent_diff := case when (v_old.agent_id is null and v_old.agent_name is null) or (v_agent is null and v_name is null) then false
    when v_old.agent_id is not null and v_agent is not null then v_old.agent_id<>v_agent
    else lower(trim(coalesce(v_old.agent_name,'')))<>lower(trim(coalesce(v_name,''))) end;
  v_replace := p_source='export' or (v_old.source<>'export' and (
    (v_final and not v_old.finalized) or
    (v_final=v_old.finalized and (
      (p_source='webhook' and v_old.source='api' and p_observed_at>=v_old.observed_at) or
      -- Validated against the platform export: final API timestamps resolve one-second webhook precision differences.
      (p_source='api' and v_old.source='webhook' and v_final and (not v_agent_diff or v_transfer_verified) and abs(v_old.talk_seconds-v_talk)<=1 and p_observed_at>=v_old.observed_at) or
      (p_source=v_old.source and p_observed_at>=v_old.observed_at)
    ))));
  v_review := v_old.review_reason;
  v_comparison := v_old.comparison_data;
  -- An absent API user is missing information, not evidence against a captured webhook user.
  if p_source='export' then v_review := null; v_comparison := null;
  elsif v_old.source<>'export' and v_old.finalized and v_final and
      (p_source<>v_old.source or p_observed_at>=v_old.observed_at) and
      (abs(v_old.talk_seconds-v_talk)>1 or (v_agent_diff and not v_transfer_verified)) then
    v_review := 'Finalized sources disagree on agent or talk time';
    v_comparison := jsonb_build_object('source',p_source,'observed_at',p_observed_at,'call',p_call,'talk_seconds',v_talk);
  elsif (p_source='api' or v_transfer_verified) and v_old.finalized and v_final and abs(v_old.talk_seconds-v_talk)<=1 and (not v_agent_diff or v_transfer_verified) then
    v_review := null; v_comparison := null;
  end if;
  update public.aircall_reporting_calls set
    started_at=case when v_replace then v_started else started_at end,
    answered_at=case when v_replace then v_answered else answered_at end,
    ended_at=case when v_replace then v_ended else ended_at end,
    agent_id=case when v_replace and p_source='export' then v_agent
      when v_replace and v_agent is not null then v_agent
      when v_replace and v_keep_identity then agent_id when v_replace then null else agent_id end,
    agent_name=case when v_replace and p_source='export' then v_name
      when v_replace and v_agent is not null and v_agent is distinct from v_old.agent_id then v_name
      when v_replace and v_name is not null then v_name
      when v_replace and v_keep_identity then agent_name when v_replace then null
      when p_source='api' and v_old.source<>'export' and v_agent=v_old.agent_id and v_name is not null then v_name
      else agent_name end,
    raw_digits=case when v_replace then coalesce(p_call->>'raw_digits','') else coalesce(raw_digits,p_call->>'raw_digits','') end,
    talk_seconds=case when v_replace then v_talk else talk_seconds end,
    finalized=case when v_replace then v_final else finalized end,
    source=case when v_replace then p_source else source end,
    observed_at=case when v_replace then p_observed_at else observed_at end,
    call_data=case when v_replace then v_data else call_data end,
    api_seen_at=case when p_source='api' then now() else api_seen_at end,
    webhook_seen_at=case when p_source='webhook' then now() else webhook_seen_at end,
    review_reason=v_review, comparison_data=v_comparison, updated_at=now()
  where call_id=v_id;
end;
$$;
revoke all on function public.ingest_aircall_reporting_call(jsonb,text,bigint,boolean) from public, anon, authenticated;
grant execute on function public.ingest_aircall_reporting_call(jsonb,text,bigint,boolean) to service_role;

create or replace function public.ingest_aircall_reporting_calls(p_calls jsonb, p_source text default 'api')
returns void language plpgsql set search_path = public as $$
declare v_call jsonb;
begin
  for v_call in select value from jsonb_array_elements(p_calls) order by (value->>'id')::bigint loop
    perform public.ingest_aircall_reporting_call(v_call,p_source,extract(epoch from now())::bigint,true);
  end loop;
end;
$$;
revoke all on function public.ingest_aircall_reporting_calls(jsonb,text) from public, anon, authenticated;
grant execute on function public.ingest_aircall_reporting_calls(jsonb,text) to service_role;

create or replace function public.capture_aircall_event_to_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_final jsonb; v_timestamp bigint;
begin
  if new.event_type like 'call.%' then
    perform public.ingest_aircall_reporting_call(new.payload->'data','webhook',new.event_timestamp,new.event_type='call.ended');
  end if;
  if new.event_type='call.transferred' then
    -- Delivery order is not guaranteed. Rebuild a final call when its successful transfer arrives late.
    select payload->'data',event_timestamp into v_final,v_timestamp from public.aircall_call_events
    where call_id=new.call_id and event_type='call.ended' order by event_timestamp desc,event_key desc limit 1;
    if found then perform public.ingest_aircall_reporting_call(v_final,'webhook',v_timestamp,true); end if;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_aircall_event_to_ledger() from public, anon, authenticated;
do $$ begin
  if not exists(select 1 from pg_trigger where tgname='aircall_event_to_ledger' and tgrelid='public.aircall_call_events'::regclass) then
    create trigger aircall_event_to_ledger after insert or update on public.aircall_call_events
    for each row execute function public.capture_aircall_event_to_ledger();
  end if;
end $$;
