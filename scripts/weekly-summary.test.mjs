import test from 'node:test'
import assert from 'node:assert/strict'
import { addAppointment, canonicalWeeklySeller, combineAppointments, historicalRevenue, isHubSpotNoAnswer, mean, meetingStatus, ratioPercent } from '../api/_lib/weekly-summary.ts'

test('Meeting outcomes and English/Spanish/Portuguese titles identify no-shows once', () => {
  for (const title of ['Canceled: Analysis', 'Cancelled: Analysis', 'CANCELADO - Analysis', 'Cancelada: Consulta', 'Cancelación: Consulta']) assert.equal(meetingStatus('SCHEDULED', title), 'CANCELED')
  assert.equal(meetingStatus('SCHEDULED', 'No-show: Analysis'), 'NO_SHOW')
  assert.equal(meetingStatus('COMPLETED', 'Not canceled: Analysis'), 'COMPLETED')
  const bucket = { total: 0, noShows: 0, rate: 0 }
  addAppointment(bucket, 'CANCELED', 'Canceled: Analysis')
  addAppointment(bucket, 'NO_SHOW', 'Analysis')
  addAppointment(bucket, 'COMPLETED', 'Analysis')
  addAppointment(bucket, 'SCHEDULED', 'Analysis')
  assert.equal(bucket.total, 4)
  assert.equal(bucket.noShows, 2)
  assert.equal(bucket.rate, 50)
  assert.equal(bucket.canceled, 1)
  assert.equal(bucket.missed, 1)
})

test('Team appointment rates use meeting counts rather than averaging unlike denominators', () => {
  const result = combineAppointments([{ total: 2, noShows: 1, rate: 50 }, { total: 10, noShows: 1, rate: 10 }])
  assert.equal(result.total, 12)
  assert.equal(result.noShows, 2)
  assert.ok(Math.abs(result.rate - 100 / 6) < 1e-9)
})

test('Revenue history includes zero weeks, normalizes old owner aliases, and excludes future weeks', () => {
  const history = [
    { fromDate: '2026-09-28', toDate: '2026-10-03', bySeller: { 'Alice F': 100 } },
    { fromDate: '2026-10-05', toDate: '2026-10-10', bySeller: {} },
    { fromDate: '2026-10-12', toDate: '2026-10-17', bySeller: { 'Aline Strelow': 200 } },
    { fromDate: '2026-10-19', toDate: '2026-10-24', bySeller: { 'Aline Strelow': 900 } },
  ]
  assert.deepEqual(historicalRevenue(history, 'Aline Strelow', '2026-10-12'), { average: 100, highest: 200, weeks: 3 })
  assert.equal(canonicalWeeklySeller('Alejandra Olaya'), 'Alejandra Oyala')
})

test('Undefined denominators are not fabricated as zero and mean agent rates stay distinct', () => {
  assert.equal(ratioPercent(0, 0), null)
  assert.equal(ratioPercent(5, 20), 25)
  assert.equal(mean([null, 10, 20]), 15)
  assert.equal(mean([]), null)
})

test('HubSpot No Answer disposition is recognized even when generic status says COMPLETED', () => {
  assert.equal(isHubSpotNoAnswer({ hs_call_status: 'COMPLETED', hs_call_disposition: '73a0d17f-1163-4015-bdd5-ec830791da20' }), true)
  assert.equal(isHubSpotNoAnswer({ hs_call_status: 'COMPLETED', hs_call_disposition: 'f240bbac-87c9-4f6e-bf70-924b57d47db7' }), false)
})
