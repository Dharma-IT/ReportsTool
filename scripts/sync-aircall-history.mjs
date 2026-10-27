import fs from 'node:fs/promises'
import { loadEnv } from 'vite'
import { AircallLedger } from '../api/_lib/aircall-ledger.ts'

const [fromDate, toDate, cacheFile] = process.argv.slice(2)
if (![fromDate, toDate].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) || fromDate > toDate) throw new Error('Usage: node scripts/sync-aircall-history.mjs FROM TO [complete-api-cache.json]')
const env = loadEnv('development', process.cwd(), '')
const ledger = new AircallLedger(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const cached = cacheFile ? JSON.parse(await fs.readFile(cacheFile, 'utf8')) : []
const eastern = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
const cachedDates = new Set(cached.map((call) => eastern.format(new Date(call.started_at * 1000))))
let lastRequest = 0
async function apiPage(url) {
  const target = new URL(url)
  if (target.hostname !== 'api.aircall.io' || target.protocol !== 'https:') throw new Error('Invalid Aircall pagination link')
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1100 - (Date.now() - lastRequest))))
    lastRequest = Date.now()
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Authorization: `Basic ${Buffer.from(`${env.AIRCALL_API_ID}:${env.AIRCALL_API_TOKEN}`).toString('base64')}` } })
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(60, Number(response.headers.get('Retry-After')) || 5) * 1000))
      continue
    }
    if (!response.ok) throw new Error(`Aircall API returned ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.calls)) throw new Error('Invalid Aircall calls response')
    return payload
  }
  throw new Error('Aircall API retries exhausted')
}
let failed = 0
for (let date = fromDate; date <= toDate;) {
  // October is in daylight time. Derive the offset so this tool also works across DST changes.
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' }).formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00'
  const from = Date.parse(`${date}T00:00:00${offset}`) / 1000
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
  const nextDate = next.toISOString().slice(0, 10)
  const nextOffset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' }).formatToParts(next).find((p) => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00'
  const to = Math.min(Math.floor(Date.now() / 1000), Date.parse(`${nextDate}T00:00:00${nextOffset}`) / 1000 - 1)
  if (from > to) break
  const previous = await ledger.syncStatus(from, to)
  if (previous?.last_success && !previous.last_error && date !== eastern.format(new Date())) {
    console.log(JSON.stringify({ date, status: 'previously synchronized' }))
  } else {
    let count = 0
    const error = await ledger.sync(from, to, async (persist) => {
      if (cachedDates.has(date)) {
        const rows = cached.filter((call) => call.started_at >= from && call.started_at <= to)
        count = rows.length; await persist(rows); return rows
      }
      const calls = [], seen = new Set()
      let url = `https://api.aircall.io/v1/calls?from=${from}&to=${to}&per_page=50`
      while (url) {
        if (seen.has(url)) throw new Error('Repeated Aircall pagination page')
        seen.add(url)
        const payload = await apiPage(url)
        await persist(payload.calls)
        calls.push(...payload.calls); count += payload.calls.length
        url = payload.meta?.next_page_link
      }
      return calls
    }, true)
    if (error) failed++
    console.log(JSON.stringify({ date, status: error ? 'needs retry' : 'synchronized', calls: count, ...(error ? { error } : {}) }))
  }
  date = nextDate
}
if (failed) throw new Error(`${failed} day(s) need retry; completed days and partial API pages are already saved.`)
