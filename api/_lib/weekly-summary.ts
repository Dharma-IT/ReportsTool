import { contactName, type ContactAgent } from './weekly-contact.ts'

export const canonicalWeeklySeller = (name: string) => contactName(name, 'sales') ?? contactName(name, 'cs') ?? name.trim()
export const ratioPercent = (numerator: number, denominator: number): number | null => denominator > 0 ? numerator / denominator * 100 : null
export const mean = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

export type AppointmentBucket = { total: number; noShows: number; rate: number; canceled?: number; missed?: number; unresolved?: number }
export function meetingStatus(outcome: string, title = '') {
  const name = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const canceled = /\b(?:canceled|cancelled|cancelad[oa]s?|cancelacion|cancelamento)\b/.test(name) && !/\b(?:not|no|nao)\s+(?:canceled|cancelled|cancelad[oa])\b/.test(name)
  if (canceled) return 'CANCELED'
  if (/\bno[\s-]?show\b|\bno asistio\b|\bnao compareceu\b/.test(name)) return 'NO_SHOW'
  return outcome.toUpperCase() === 'CANCELLED' ? 'CANCELED' : outcome.toUpperCase()
}
export function addAppointment(bucket: AppointmentBucket, outcome: string, title = '') {
  const status = meetingStatus(outcome, title)
  bucket.total++
  if (status === 'CANCELED') bucket.canceled = (bucket.canceled ?? 0) + 1
  if (status === 'NO_SHOW') bucket.missed = (bucket.missed ?? 0) + 1
  if (!['COMPLETED', 'CANCELED', 'NO_SHOW', 'RESCHEDULED', 'SCHEDULED'].includes(status)) bucket.unresolved = (bucket.unresolved ?? 0) + 1
  if (status === 'CANCELED' || status === 'NO_SHOW') bucket.noShows++
  bucket.rate = bucket.noShows / bucket.total * 100
}

export function combineAppointments(buckets: Array<AppointmentBucket | undefined>): AppointmentBucket {
  const result: AppointmentBucket = { total: 0, noShows: 0, rate: 0, canceled: 0, missed: 0, unresolved: 0 }
  for (const bucket of buckets) {
    if (!bucket) continue
    result.total += bucket.total; result.noShows += bucket.noShows
    result.canceled! += bucket.canceled ?? 0; result.missed! += bucket.missed ?? 0; result.unresolved! += bucket.unresolved ?? 0
  }
  result.rate = result.total ? result.noShows / result.total * 100 : 0
  return result
}

export type RevenueWeek = { fromDate: string; toDate: string; bySeller: Record<string, number> }
export function historicalRevenue(weeks: RevenueWeek[], seller: string, selectedWeek: string) {
  const included = weeks.filter((week) => week.fromDate <= selectedWeek)
  const values = included.map((week) => Object.entries(week.bySeller).reduce((sum, [name, value]) => sum + (canonicalWeeklySeller(name) === canonicalWeeklySeller(seller) ? value : 0), 0))
  return { average: mean(values), highest: values.length ? Math.max(...values) : null, weeks: values.length }
}

export function isHubSpotNoAnswer(properties: { hs_call_status?: string | null; hs_call_disposition?: string | null }) {
  return properties.hs_call_disposition === '73a0d17f-1163-4015-bdd5-ec830791da20' || properties.hs_call_status?.toUpperCase() === 'NO_ANSWER'
}

export function keepWeeklySeller(name: string, team: 'sales' | 'cs', roster?: ContactAgent[]) {
  return Boolean(contactName(name, team, roster)) && !['denis reis', 'paula alfonso', 'maria sandoval'].includes(name.trim().toLowerCase())
}
