import { databaseQuery } from './aircall-ledger-admin.mjs'

await databaseQuery(`
begin;
select public.ingest_aircall_reporting_call('{"id":-4280000004,"direction":"inbound","started_at":100,"answered_at":null,"ended_at":null,"user":{"id":111,"name":"Ringing agent"}}','webhook',100,false);
select public.ingest_aircall_reporting_call('{"id":-4280000004,"direction":"inbound","started_at":100,"answered_at":null,"ended_at":130,"user":null}','webhook',200,true);
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000004 and finalized and agent_name is null and agent_id is null and talk_seconds=0) then raise exception 'Unanswered incoming call was incorrectly assigned to a ringing agent'; end if;
end $$;
select public.ingest_aircall_reporting_call('{"id":-4280000002,"started_at":100,"answered_at":110,"ended_at":130,"user":{"id":123,"name":"Known agent"}}','webhook',200,true);
select public.ingest_aircall_reporting_call('{"id":-4280000002,"started_at":100,"answered_at":110,"ended_at":130,"user":null}','api',300,true);
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000002 and agent_name='Known agent' and talk_seconds=20 and review_reason is null) then raise exception 'Missing API user incorrectly conflicted with or erased webhook identity'; end if;
end $$;
select public.ingest_aircall_reporting_call('{"id":-4280000002,"started_at":100,"answered_at":110,"ended_at":129,"user":null}','api',400,true);
select public.ingest_aircall_reporting_call('{"id":-4280000002,"started_at":100,"answered_at":110,"ended_at":130,"user":{"id":123,"name":"Known agent"}}','webhook',200,true);
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000002 and source='api' and agent_name='Known agent' and talk_seconds=19 and review_reason is null) then raise exception 'API precision correction regressed or erased webhook agent'; end if;
end $$;
insert into public.aircall_call_events(event_key,call_id,event_type,event_timestamp,payload)
values('ledger-transaction-test',-4280000003,'call.ended',200,'{"data":{"id":-4280000003,"started_at":100,"answered_at":110,"ended_at":130,"user":{"name":"Trigger agent"}}}');
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000003 and source='webhook' and finalized and talk_seconds=20) then raise exception 'Raw webhook did not populate shared ledger'; end if;
end $$;
insert into public.aircall_call_events(event_key,call_id,event_type,event_timestamp,payload)
values('ledger-transfer-delivery-test',-4280000003,'call.transferred',150,'{"data":{"id":-4280000003,"started_at":100,"answered_at":110,"ended_at":null,"user":{"id":456,"name":"Recipient"},"transferred_to":{"id":456,"name":"Recipient"}}}');
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000003 and agent_name='Recipient' and finalized and talk_seconds=20 and review_reason is null) then raise exception 'Late transfer did not reconcile final recipient'; end if;
end $$;
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":null,"ended_at":null,"user":{"name":"Ledger test"}
}', 'webhook', 100, false);
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":120,"ended_at":180,"user":{"name":"Final agent"}
}', 'webhook', 200, true);
-- Duplicate final event, then a late provisional event and an older final event.
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":120,"ended_at":180,"user":{"name":"Final agent"}
}', 'webhook', 200, true);
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":null,"ended_at":null,"user":{"name":"Original agent"}
}', 'webhook', 110, false);
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":120,"ended_at":150,"user":{"name":"Original agent"}
}', 'webhook', 150, true);
do $$ begin
  if (select count(*) from public.aircall_reporting_calls where call_id=-4280000001)<>1 then raise exception 'Duplicate ledger call'; end if;
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000001 and finalized and talk_seconds=60 and agent_name='Final agent' and review_reason is null) then raise exception 'Late event regressed final call'; end if;
end $$;
-- A conflicting API snapshot flags the discrepancy, while retaining final webhook values.
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":120,"ended_at":170,"user":{"name":"Final agent"}
}', 'api', 300, true);
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000001 and talk_seconds=60 and review_reason is not null and api_seen_at is not null) then raise exception 'API conflict was not retained and flagged'; end if;
end $$;
-- An independently reconciled export resolves the conflict and remains authoritative.
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":120,"ended_at":180,"talk_seconds":65,"user":{"name":"Export agent"}
}', 'export', 400, true);
select public.ingest_aircall_reporting_call('{
  "id":-4280000001,"started_at":100,"answered_at":120,"ended_at":180,"user":{"name":"Final agent"}
}', 'webhook', 500, true);
do $$ begin
  if not exists(select 1 from public.aircall_reporting_calls where call_id=-4280000001 and source='export' and talk_seconds=65 and agent_name='Export agent' and review_reason is null) then raise exception 'Export reconciliation was overwritten'; end if;
end $$;
rollback;
`)
console.log('Live database ledger tests passed; all test records rolled back.')
