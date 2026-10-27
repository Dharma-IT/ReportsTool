import fs from 'node:fs/promises'
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), '')
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
export async function databaseQuery(query, readOnly = false) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: readOnly }), signal: AbortSignal.timeout(120000),
  })
  const result = await r.json()
  if (!r.ok) throw new Error(`Database query failed (${r.status}): ${JSON.stringify(result)}`)
  return result
}

if (process.argv[2] === 'functions') {
  const migration = await fs.readFile('scripts/create-aircall-ledger.sql', 'utf8')
  const start = migration.indexOf('create or replace function public.ingest_aircall_reporting_call(')
  const end = migration.indexOf('do $$ begin', migration.indexOf('create or replace function public.capture_aircall_event_to_ledger()'))
  await databaseQuery(migration.slice(start, end))
  console.log('Updated ledger merge functions without table or trigger DDL.')
} else if (process.argv[2] === 'migrate') {
  const migration = await fs.readFile('scripts/create-aircall-ledger.sql', 'utf8')
  await databaseQuery(migration)
  console.log('Applied additive Aircall reporting ledger migration.')
} else if (process.argv[2] === 'backfill') {
  const fromDate = process.argv[3]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate ?? '')) throw new Error('Backfill requires a starting date: backfill YYYY-MM-DD')
  const fromUnix = Math.floor(Date.parse(`${fromDate}T00:00:00Z`) / 1000)
  // Choose one final snapshot per call first; late provisional events cannot supersede it.
  let cursor = 0, total = 0
  while (true) {
    const [result] = await databaseQuery(`
      with ids as materialized (
        select distinct call_id from public.aircall_call_events where call_id>${cursor} and event_timestamp>=${fromUnix} order by call_id limit 1000
      ), candidates as materialized (
        select distinct on (e.call_id) e.call_id,e.payload->'data' as data,e.event_timestamp,e.event_type
        from public.aircall_call_events e join ids using(call_id)
        where e.payload->'data'->>'started_at' is not null
        order by e.call_id,(e.event_type='call.ended') desc,e.event_timestamp desc,e.event_key desc
      ), imported as materialized (
        select public.ingest_aircall_reporting_call(data,'webhook',event_timestamp,event_type='call.ended') from candidates
      )
      select (select count(*) from imported) as calls_processed,(select max(call_id) from ids) as next_cursor;
    `)
    if (!result.next_cursor) break
    cursor = Number(result.next_cursor); total += Number(result.calls_processed)
    console.log(JSON.stringify({ callsProcessed: total, cursor }))
  }
} else if (process.argv[2] === 'backfill-transfers') {
  const fromDate = process.argv[3]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate ?? '')) throw new Error('Transfer backfill requires a starting date')
  const fromUnix = Math.floor(Date.parse(`${fromDate}T00:00:00Z`) / 1000)
  console.log(JSON.stringify(await databaseQuery(`with ids as materialized (
    select distinct call_id from public.aircall_call_events where event_timestamp>=${fromUnix} and event_type='call.transferred'
  ), finals as materialized (
    select distinct on(e.call_id) e.payload->'data' data,e.event_timestamp from public.aircall_call_events e join ids using(call_id)
    where e.event_type='call.ended' order by e.call_id,e.event_timestamp desc
  ), imported as materialized (
    select public.ingest_aircall_reporting_call(data,'webhook',event_timestamp,true) from finals
  ) select count(*) transfer_calls_reconciled from imported`)))
} else if (process.argv[2] === 'fill-phones') {
  const fromDate = process.argv[3]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate ?? '')) throw new Error('Phone backfill requires a starting date: fill-phones YYYY-MM-DD')
  const fromUnix = Math.floor(Date.parse(`${fromDate}T00:00:00Z`) / 1000)
  let total = 0
  while (true) {
    const [result] = await databaseQuery(`with ids as materialized (
      select call_id from public.aircall_reporting_calls where started_at>=${fromUnix} and raw_digits is null order by call_id limit 1000 for update skip locked
    ), updated as (
      update public.aircall_reporting_calls c set raw_digits=coalesce(c.call_data->>'raw_digits','') from ids where c.call_id=ids.call_id returning c.call_id
    ) select count(*) updated from updated`)
    const count = Number(result.updated); total += count
    if (!count) break
    console.log(JSON.stringify({ phoneFieldsRestored: total }))
  }
} else if (process.argv[2] === 'status') {
  console.log(JSON.stringify(await databaseQuery(`select source,finalized,count(*) as calls,count(*) filter(where review_reason is not null) as needs_review from public.aircall_reporting_calls group by source,finalized order by source,finalized`, true)))
}
