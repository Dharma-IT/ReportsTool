import fs from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { AircallLedger } from '../api/_lib/aircall-ledger.ts'
import { loadEnv } from 'vite'
import { aggregateWeeklyAircallCsv, aircallCallsFromCsv, aggregateWeeklyDoxy, combineWeeklyContact, parseContactCsv } from '../api/_lib/weekly-contact.ts'

// Reconcile only the contact section; preserve revenue and all other weekly sections.
const [week, aircallFile, doxyFile, apply] = process.argv.slice(2)
if (!/^\d{4}-\d{2}-\d{2}$/.test(week ?? '') || new Date(`${week}T12:00:00Z`).getUTCDay() !== 1 || !aircallFile || !doxyFile || (apply && apply !== '--apply')) {
  throw new Error('Usage: node scripts/reconcile-weekly-contact.mjs YYYY-MM-DD aircall.csv doxy.csv [--apply]')
}
const end = new Date(`${week}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 5)
const to = end.toISOString().slice(0, 10)
const [aircallText, doxyText] = await Promise.all([fs.readFile(aircallFile, 'utf8'), fs.readFile(doxyFile, 'utf8')])
const records = parseContactCsv(aircallText), headers = records.shift().map((v) => v.replace(/^\uFEFF/, '').trim().toLowerCase())
const indexes = ['call start time', 'user', 'duration (in call)', 'call id (internal)'].map((h) => headers.indexOf(h))
if (indexes.includes(-1)) throw new Error('Aircall export is missing required columns.')
const dates = new Set()
for (const row of records) {
  const date = row[indexes[0]].slice(0, 10)
  if (date < week || date > to) continue
  dates.add(date)
}
if (dates.size !== 6) throw new Error('Aircall export must cover all six Monday–Saturday reporting days.')
const e = loadEnv('development', process.cwd(), '')
const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL, key = e.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase configuration unavailable.')
const request = async (query, init = {}) => {
  const r = await fetch(new URL(`/rest/v1/${query}`, url), { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers } })
  if (!r.ok) throw new Error(`Supabase returned ${r.status}`)
  return r
}
const saved = await (await request(`weekly_reports?week_start=eq.${week}&select=*`)).json()
if (saved.length !== 1) throw new Error('An existing weekly report is required; no other sections will be created or replaced.')
const daily = await (await request(`daily_reports?from_date=gte.${week}&to_date=lte.${to}&select=team,from_date,to_date,report_data`)).json()
const data = structuredClone(saved[0].report_data)
const fetchedAt = new Date().toISOString()
data.aircall = {
  version: 1, fetchedAt,
  sales: aggregateWeeklyAircallCsv(aircallText, week, to, 'sales'), cs: aggregateWeeklyAircallCsv(aircallText, week, to, 'cs'),
  uploaded: Object.fromEntries(['sales', 'cs'].map((team) => [team, { fileName: path.basename(aircallFile), uploadedAt: fetchedAt }])),
}
data.doxy = { ...data.doxy, sales: aggregateWeeklyDoxy(doxyText, week, to, 'sales'), cs: aggregateWeeklyDoxy(doxyText, week, to, 'cs') }
data.contactReconciliation = { savedAt: fetchedAt, aircallFile: path.basename(aircallFile), doxyFile: path.basename(doxyFile), from: week, to, timezone: 'America/New_York' }
const result = {}
for (const team of ['sales', 'cs']) {
  const contact = combineWeeklyContact(data.aircall[team], data.doxy[team])
  const previous = new Map()
  for (const day of daily.filter((r) => r.team === team && r.from_date === r.to_date)) for (const agent of day.report_data.agents ?? []) {
    const row = previous.get(agent.name) ?? { aircallSeconds: 0, doxySeconds: 0 }
    row.aircallSeconds += agent.totalTalkSeconds ?? 0; row.doxySeconds += agent.doxyTotalSeconds ?? 0
    previous.set(agent.name, row)
  }
  result[team] = contact.agents.map((a) => ({ ...a, previous: previous.get(a.name) ?? null }))
}
console.log(JSON.stringify({ week, to, applied: !!apply, teams: result, missingDoxyDurations: data.doxy.sales.reduce((s, a) => s + (a.unknownDurationCalls ?? 0), 0) }, null, 2))
if (apply) {
  await fs.mkdir('migration-backups', { recursive: true })
  const backup = `migration-backups/weekly-contact-${week}-${Date.now()}.json`
  await fs.writeFile(backup, JSON.stringify(saved, null, 2))
  await new AircallLedger(url, key).ingest(aircallCallsFromCsv(aircallText, week, to), 'export')
  await request(`weekly_reports?week_start=eq.${week}`, { method: 'PATCH', body: JSON.stringify({ report_data: data }) })
  const verified = await (await request(`weekly_reports?week_start=eq.${week}&select=report_data`)).json()
  if (!isDeepStrictEqual(verified[0].report_data, data)) throw new Error('Saved weekly report verification failed.')
  console.log(`Saved and verified weekly contact totals. Backup: ${backup}`)
}
