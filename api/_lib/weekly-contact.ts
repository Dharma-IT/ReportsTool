import { talkSeconds } from './aircall-ledger.ts'

export type ContactTeam = 'sales' | 'cs'
export type ContactAgent = { name: string; aliases: string[] }
export type AircallMetric = { name: string; aircallSeconds: number; aircallCalls: number }
export type DoxyMetric = { name: string; doxySeconds: number; doxyCalls: number; unknownDurationCalls?: number }

export function contactDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const agents: Record<ContactTeam, string[]> = {
  sales: ['Yaneth Rodriguez', 'Alejandra Oyala', 'Carlos Vargas', 'Helen Gutierrez', 'Diana Villalobos'],
  cs: ['Arles Martinez', 'Aline Strelow', 'Brayam Zuluaga', 'Edmilson Morales'],
}
const aliases: Record<string, string> = {
  'alejandra olaya': 'alejandra oyala', 'alice strelow': 'aline strelow',
  'alice f': 'aline strelow', 'ailene nuevas': 'aline strelow',
  'brayan zuluaga': 'brayam zuluaga', 'edmilson velasquez': 'edmilson morales',
}
export const normalizedContactName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function contactName(value: string, team: ContactTeam, roster?: ContactAgent[]) {
  const key = normalizedContactName(value)
  if (roster) return roster.find((agent) => [agent.name, ...agent.aliases].some((name) => {
    const alias = normalizedContactName(name)
    return (aliases[alias] ?? alias) === (aliases[key] ?? key)
  }))?.name
  return agents[team].find((name) => normalizedContactName(name) === (aliases[key] ?? key))
}

// Aircall Call History attributes each row to its user, including received transfers.
export function aggregateWeeklyAircall(calls: Array<{ id: number; started_at?: number; user?: { name?: string | null } | null; answered_at: number | null; ended_at: number | null; talk_seconds?: number; finalized?: boolean }>, team: ContactTeam, roster?: ContactAgent[]): AircallMetric[] {
  const rows = new Map<string, AircallMetric>()
  const seen = new Set<number>()
  for (const call of calls) {
    if (seen.has(call.id)) continue
    seen.add(call.id)
    const name = contactName(call.user?.name ?? '', team, roster)
    if (!name) continue
    const row = rows.get(name) ?? { name, aircallSeconds: 0, aircallCalls: 0 }
    row.aircallCalls += 1
    row.aircallSeconds += talkSeconds({ ...call, started_at: call.started_at ?? 0 })
    rows.set(name, row)
  }
  return [...rows.values()]
}

export function parseContactCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(field); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''
    } else field += character
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.')
  row.push(field); if (row.some(Boolean)) rows.push(row)
  return rows
}

export function aircallCallsFromCsv(text: string, from: string, to: string) {
  const records = parseContactCsv(text)
  const headers = records.shift()?.map((value) => value.replace(/^\uFEFF/, '').trim().toLowerCase()) ?? []
  const indexes = ['call start time', 'user', 'duration (in call)', 'call id (internal)'].map((name) => headers.indexOf(name))
  if (indexes.includes(-1)) throw new Error('Aircall CSV needs Call start time, User, Duration (in call), and Call id (internal) columns.')
  // Number timezone belongs to the phone line and can differ from the export's timezone.
  const utcIndex = headers.indexOf('datetime (utc)')
  const easternDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
  const calls = records.flatMap((record) => {
    const utc = utcIndex >= 0 ? record[utcIndex]?.trim() : ''
    const instant = utc ? new Date(`${utc.replace(' ', 'T')}Z`) : null
    if (instant && Number.isNaN(instant.getTime())) throw new Error('Aircall CSV contains an invalid UTC date.')
    const date = instant ? easternDate.format(instant) : record[indexes[0]]?.slice(0, 10) ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < from || date > to) return []
    const id = Number(record[indexes[3]]), seconds = Number(record[indexes[2]] || 0)
    if (!Number.isSafeInteger(id) || !Number.isFinite(seconds) || seconds < 0) throw new Error('Aircall CSV contains an invalid call ID or duration.')
    // UTC is authoritative. Older exports without it must be exported in New York time.
    let started = instant ? Math.floor(instant.getTime() / 1000) : 0
    if (!instant) {
      const local = record[indexes[0]].replace(' ', 'T')
      const guess = new Date(`${local}Z`)
      const utcParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'longOffset' }).formatToParts(guess)
      const offset = utcParts.find((part) => part.type === 'timeZoneName')?.value.replace('GMT', '') || '+00:00'
      started = Math.floor(new Date(`${local}${offset}`).getTime() / 1000)
    }
    if (!Number.isFinite(started)) throw new Error('Aircall CSV contains an invalid call start time.')
    const totalIndex = headers.indexOf('duration (total)')
    const total = totalIndex >= 0 ? Math.max(seconds, Number(record[totalIndex]) || 0) : seconds
    const ended = started + total
    const customerIndex = headers.indexOf('customer number')
    const userName = record[indexes[1]] === '[No associated user]' ? null : record[indexes[1]]
    return [{ id, started_at: started, user: userName ? { name: userName } : null, answered_at: seconds > 0 ? ended - seconds : null, ended_at: ended, talk_seconds: seconds, raw_digits: customerIndex >= 0 ? record[customerIndex] : '' }]
  })
  return calls
}

export function aggregateWeeklyAircallCsv(text: string, from: string, to: string, team: ContactTeam, roster?: ContactAgent[]): AircallMetric[] {
  return aggregateWeeklyAircall(aircallCallsFromCsv(text, from, to), team, roster)
}

export function aggregateWeeklyDoxy(text: string, from: string, to: string, team: ContactTeam, roster?: ContactAgent[]): DoxyMetric[] {
  const records = parseContactCsv(text)
  const headers = records.shift()?.map((value) => value.replace(/^\uFEFF/, '').trim().toLowerCase()) ?? []
  const dateIndex = headers.indexOf('date'), providerIndex = headers.indexOf('provider name'), durationIndex = headers.indexOf('duration')
  if ([dateIndex, providerIndex, durationIndex].some((index) => index < 0)) throw new Error('This CSV needs Date, Provider name, and Duration columns.')
  const metrics = new Map<string, DoxyMetric>()
  for (const record of records) {
    const rawDate = (record[dateIndex] ?? '').trim()
    const us = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
    const date = us ? `${us[3].length === 2 ? `20${us[3]}` : us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : rawDate.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < from || date > to) continue
    const name = contactName(record[providerIndex] ?? '', team, roster)
    if (!name) continue
    const row = metrics.get(name) ?? { name, doxySeconds: 0, doxyCalls: 0, unknownDurationCalls: 0 }
    row.doxyCalls += 1
    const duration = (record[durationIndex] ?? '').trim()
    if (/^\d+:[0-5]\d:[0-5]\d$/.test(duration)) {
      const [hours, minutes, seconds] = duration.split(':').map(Number)
      row.doxySeconds += hours * 3600 + minutes * 60 + seconds
    } else row.unknownDurationCalls = (row.unknownDurationCalls ?? 0) + 1
    metrics.set(name, row)
  }
  return [...metrics.values()]
}

export function combineWeeklyContact(aircall: AircallMetric[], doxy?: DoxyMetric[]) {
  const rows = new Map(aircall.map((agent) => [normalizedContactName(agent.name), { ...agent, doxySeconds: 0, doxyCalls: 0 }]))
  for (const uploaded of doxy ?? []) {
    const key = normalizedContactName(uploaded.name)
    const row = rows.get(key) ?? { name: uploaded.name, aircallSeconds: 0, aircallCalls: 0, doxySeconds: 0, doxyCalls: 0 }
    row.doxySeconds = uploaded.doxySeconds; row.doxyCalls = uploaded.doxyCalls
    rows.set(key, row)
  }
  return { agents: [...rows.values()], doxyUploaded: doxy !== undefined, unknownDurationCalls: (doxy ?? []).reduce((sum, row) => sum + (row.unknownDurationCalls ?? 0), 0) }
}
