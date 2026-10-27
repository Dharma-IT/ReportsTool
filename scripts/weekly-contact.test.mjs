import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateWeeklyAircall, aggregateWeeklyAircallCsv, aggregateWeeklyDoxy, combineWeeklyContact, contactDuration } from '../api/_lib/weekly-contact.ts'

test('Contact durations retain seconds and hours over 24', () => {
  assert.equal(contactDuration(24518), '6:48:38')
  assert.equal(contactDuration(58557), '16:15:57')
  assert.equal(contactDuration(94712), '26:18:32')
})

test('Team roster updates include new agents in Weekly Aircall and Doxy', () => {
  const roster = [{ name: 'New Agent', aliases: ['New Agent', 'Provider Alias'] }]
  assert.equal(aggregateWeeklyAircall([{ id: 1, started_at: 1, answered_at: 2, ended_at: 62, user: { name: 'New Agent' } }], 'sales', roster)[0].aircallSeconds, 60)
  assert.equal(aggregateWeeklyDoxy('Date,Provider name,Duration\n10/19/26,Provider Alias,0:01:00', '2026-10-19', '2026-10-24', 'sales', roster)[0].name, 'New Agent')
})

test('Aircall credits receiving user, counts unanswered calls once, and deduplicates IDs', () => {
  const transfer = { id: 1, user: { name: 'Carlos Vargas' }, transferred_by: { name: 'Laura Sanchez' }, number: { name: 'Laura Sanchez' }, answered_at: 100, ended_at: 2865 }
  const result = aggregateWeeklyAircall([transfer, transfer, { id: 2, user: { name: 'Carlos Vargas' }, answered_at: null, ended_at: 4000 }], 'sales')
  assert.deepEqual(result, [{ name: 'Carlos Vargas', aircallCalls: 2, aircallSeconds: 2765 }])
})

test('Aircall export uses in-call seconds and New York dates, excluding Sunday', () => {
  const csv = 'call start time,user,duration (in call),call id (internal),number timezone,duration (total)\n2026-10-19 10:00:00,Carlos Vargas,25,1,America/New_York,100\n2026-10-24 23:59:59,Carlos Vargas,45,2,America/New_York,150\n2026-10-25 00:00:00,Carlos Vargas,5000,3,America/New_York,6000\n'
  assert.deepEqual(aggregateWeeklyAircallCsv(csv, '2026-10-19', '2026-10-24', 'sales'), [{ name: 'Carlos Vargas', aircallSeconds: 70, aircallCalls: 2 }])
  const utc = 'call start time,user,duration (in call),call id (internal),datetime (utc),number timezone\n2026-10-25 03:59:59,Carlos Vargas,45,2,2026-10-25 03:59:59,America/Chicago\n2026-10-25 04:00:00,Carlos Vargas,500,3,2026-10-25 04:00:00,America/New_York'
  assert.deepEqual(aggregateWeeklyAircallCsv(utc, '2026-10-19', '2026-10-24', 'sales'), [{ name: 'Carlos Vargas', aircallSeconds: 45, aircallCalls: 1 }])
})

test('Doxy includes Monday and Saturday, excludes Sunday and other weeks, maps aliases and Helen', () => {
  const csv = 'Date,Provider name,Duration,Provider comment\r\n10/19/26,Carlos Vargas,1:02:03,"two lines\ncomment"\r\n10/24/26,Carlos Vargas,0:25:42,\r\n10/25/26,Carlos Vargas,8:00:00,\r\n10/18/26,Carlos Vargas,8:00:00,\r\n10/23/26,Carlos Vargas,No data,\r\n10/20/26,Alejandra Olaya,0:01:00,\r\n10/20/26,Helen Gutierrez,0:02:00,\r\n'
  const result = aggregateWeeklyDoxy(csv, '2026-10-19', '2026-10-24', 'sales')
  assert.deepEqual(result, [
    { name: 'Carlos Vargas', doxySeconds: 5265, doxyCalls: 3, unknownDurationCalls: 1 },
    { name: 'Alejandra Oyala', doxySeconds: 60, doxyCalls: 1, unknownDurationCalls: 0 },
    { name: 'Helen Gutierrez', doxySeconds: 120, doxyCalls: 1, unknownDurationCalls: 0 },
  ])
})

test('Weekly uses only uploaded Doxy, distinguishes missing upload, and replaces prior upload totals', () => {
  const aircall = [{ name: 'Carlos Vargas', aircallSeconds: 240, aircallCalls: 2 }]
  assert.equal(combineWeeklyContact(aircall).doxyUploaded, false)
  assert.equal(combineWeeklyContact(aircall).agents[0].doxySeconds, 0)
  const upload = [{ name: 'Carlos Vargas', doxySeconds: 100, doxyCalls: 1 }]
  assert.equal(combineWeeklyContact(aircall, upload).agents[0].doxySeconds, 100)
  assert.equal(combineWeeklyContact(aircall, [{ ...upload[0], doxySeconds: 0 }]).agents[0].doxySeconds, 0)
  assert.equal(combineWeeklyContact(aircall, []).doxyUploaded, true)
})
