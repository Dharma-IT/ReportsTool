import { loadEnv } from 'vite'
import { AircallLedger } from '../api/_lib/aircall-ledger.ts'

const from = process.argv[2]
if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? '')) throw new Error('Usage: node scripts/recheck-aircall-conflicts.mjs FROM')
const env = loadEnv('development', process.cwd(), '')
const ledger = new AircallLedger(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const url = new URL('/rest/v1/aircall_reporting_calls', env.VITE_SUPABASE_URL)
url.searchParams.set('select', 'call_id,comparison_data')
url.searchParams.set('started_at', `gte.${Date.parse(`${from}T00:00:00Z`) / 1000}`)
url.searchParams.set('review_reason', 'not.is.null')
url.searchParams.set('limit', '1000')
const response = await fetch(url, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })
if (!response.ok) throw new Error(`Ledger query returned ${response.status}`)
const rows = await response.json()
let checked = 0, unavailable = 0, lastRequest = 0
const captured = rows.filter((row) => row.comparison_data?.source === 'api' && row.comparison_data.call)
await ledger.ingest(captured.map((row) => row.comparison_data.call), 'api')
checked += captured.length
console.log(JSON.stringify({ checked, total: rows.length, status: 'Replayed stored comparison evidence' }))
let pending = []
for (const row of rows.filter((row) => !captured.includes(row))) {
  let call = null
  if (!call) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastRequest))))
      lastRequest = Date.now()
      const r = await fetch(`https://api.aircall.io/v1/calls/${row.call_id}`, {
        signal: AbortSignal.timeout(30000), headers: { Authorization: `Basic ${Buffer.from(`${env.AIRCALL_API_ID}:${env.AIRCALL_API_TOKEN}`).toString('base64')}` },
      })
      if ((r.status === 429 || r.status >= 500) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(60, Number(r.headers.get('Retry-After')) || 5) * 1000))
        continue
      }
      if (!r.ok) { unavailable++; break }
      call = (await r.json()).call; break
    }
  }
  if (call) pending.push(call)
  checked++
  if (pending.length >= 25) { await ledger.ingest(pending, 'api'); pending = [] }
  if (checked % 25 === 0) console.log(JSON.stringify({ checked, total: rows.length, unavailable }))
}
if (pending.length) await ledger.ingest(pending, 'api')
console.log(JSON.stringify({ checked, total: rows.length, unavailable, status: 'Rechecked; genuine conflicts remain flagged.' }))
