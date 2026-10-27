import fs from 'node:fs/promises'
import { loadEnv } from 'vite'
import { AircallLedger, talkSeconds, summarizeAircall } from '../api/_lib/aircall-ledger.ts'
import { aircallCallsFromCsv, aggregateWeeklyAircall } from '../api/_lib/weekly-contact.ts'

const [from, to, csvFile, apiFile, apply] = process.argv.slice(2)
if (![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) || !csvFile || !apiFile || (apply && apply !== '--apply')) throw new Error('Usage: node scripts/reconcile-aircall-ledger.mjs FROM TO aircall.csv api-cache.json [--apply]')
const env = loadEnv('development', process.cwd(), '')
const ledger = new AircallLedger(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const calls = aircallCallsFromCsv(await fs.readFile(csvFile, 'utf8'), from, to)
if (!calls.length) throw new Error('No export calls in the selected range.')
const first = Math.min(...calls.map((call) => call.started_at)), last = Math.max(...calls.map((call) => call.started_at))
const before = await ledger.read(first, last)
const beforeById = new Map(before.map((row) => [Number(row.call_id), row]))
const missing = calls.filter((call) => !beforeById.has(call.id))
const mismatched = calls.filter((call) => {
  const existing = beforeById.get(call.id)
  return existing && (talkSeconds(existing.call_data) !== talkSeconds(call) || existing.call_data.user?.name !== call.user?.name)
})
console.log(JSON.stringify({ exportCalls: calls.length, ledgerCallsBefore: before.length, missingBefore: missing.length, mismatchedBefore: mismatched.length, apply: !!apply }))
if (apply) {
  await fs.mkdir('migration-backups', { recursive: true })
  await fs.writeFile(`migration-backups/aircall-ledger-before-${from}-${Date.now()}.json`, JSON.stringify(before))
  await ledger.ingest(JSON.parse(await fs.readFile(apiFile, 'utf8')), 'api')
  await ledger.ingest(calls, 'export')
  const after = await ledger.read(first, last)
  const byId = new Map(after.map((row) => [Number(row.call_id), row]))
  for (const call of calls) {
    const row = byId.get(call.id)
    if (!row?.finalized || row.source !== 'export' || row.review_reason || talkSeconds(row.call_data) !== talkSeconds(call) || (row.call_data.user?.name ?? null) !== (call.user?.name ?? null)) throw new Error(`Reconciliation failed for call ${call.id}`)
  }
  const final = after.filter((row) => row.finalized).map((row) => row.call_data)
  console.log(JSON.stringify({ verifiedCalls: calls.length, quality: summarizeAircall(after), sales: aggregateWeeklyAircall(final, 'sales'), cs: aggregateWeeklyAircall(final, 'cs') }))
}
