import test from 'node:test'
import assert from 'node:assert/strict'
import { AircallLedger, agentCallMetrics, summarizeAircall } from '../api/_lib/aircall-ledger.ts'
import { aggregateWeeklyAircall } from '../api/_lib/weekly-contact.ts'

test('Ledger uses indexed cursor pagination without dropping calls sharing a timestamp', async () => {
  const requests = []
  const row = (id, started) => ({ call_id: id, started_at: started, answered_at: started, ended_at: started + 10, talk_seconds: 10, agent_name: 'Carlos Vargas', finalized: true, source: 'webhook', raw_digits: '15551234567' })
  const ledger = new AircallLedger('https://test.invalid', 'test', async (input) => {
    const url = new URL(input); requests.push(url)
    return Response.json(requests.length === 1 ? Array.from({ length: 1000 }, (_, i) => row(i + 1, 100)) : [row(1001, 101)])
  })
  const records = await ledger.read(100, 200)
  assert.equal(records.length, 1001)
  assert.equal(new Set(records.map((r) => r.call_id)).size, 1001)
  assert.equal(requests[1].searchParams.get('or'), '(started_at.gt.100,and(started_at.eq.100,call_id.gt.1000))')
  assert.deepEqual(requests[0].searchParams.getAll('started_at'), ['gte.100', 'lte.200'])
  assert.equal(records[1000].call_data.id, 1001)
})

test('An API pagination failure retains already persisted pages and records an actionable error', async () => {
  const pages = [], health = []
  const ledger = new AircallLedger('https://test.invalid', 'test', async (input, init) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/rpc/ingest_aircall_reporting_calls')) pages.push(...JSON.parse(init.body).p_calls)
    else if (url.pathname.endsWith('/aircall_reporting_syncs')) health.push(JSON.parse(init.body))
    else throw new Error('Unexpected request')
    return new Response(null, { status: 204 })
  })
  const error = await ledger.sync(100, 200, async (persist) => {
    await persist([{ id: 1, started_at: 110, answered_at: 120, ended_at: 150 }])
    throw new Error('Second page timed out')
  })
  assert.equal(error, 'Second page timed out')
  assert.equal(pages.length, 1)
  assert.equal(health[0].last_error, 'Second page timed out')
})

test('Weekly talk time equals the sum of Daily talk time, including exact export adjustments', () => {
  const calls = [
    { id: 1, started_at: 100, answered_at: 110, ended_at: 200, talk_seconds: 65, user: { name: 'Carlos Vargas' }, raw_digits: '+1 555 123 4567' },
    { id: 2, started_at: 200, answered_at: null, ended_at: 300, user: { name: 'Carlos Vargas' }, raw_digits: '15551234567' },
    { id: 3, started_at: 300, answered_at: 310, ended_at: 400, user: { name: 'Carlos Vargas' }, raw_digits: '+1 555 765 4321' },
  ]
  const daily = [agentCallMetrics(calls.slice(0, 2)), agentCallMetrics(calls.slice(2))]
  const weekly = aggregateWeeklyAircall(calls, 'sales')[0]
  assert.equal(weekly.aircallSeconds, daily.reduce((s, day) => s + day.totalTalkSeconds, 0))
  assert.equal(weekly.aircallSeconds, 155)
  assert.equal(agentCallMetrics(calls).numbersCalled, 2)
  assert.equal(agentCallMetrics(calls).validCalls, 2)
})

test('Known in-progress attempts count once, while unfinished talk time stays excluded', () => {
  const calls = [{ id: 1, started_at: 100, answered_at: 110, ended_at: null, finalized: false, talk_seconds: 99, user: { name: 'Carlos Vargas' }, raw_digits: '15551234567' }]
  assert.equal(agentCallMetrics(calls).totalIntents, 1)
  assert.equal(agentCallMetrics(calls).totalTalkSeconds, 0)
  assert.equal(aggregateWeeklyAircall(calls, 'sales')[0].aircallCalls, 1)
  assert.equal(aggregateWeeklyAircall(calls, 'sales')[0].aircallSeconds, 0)
})

test('Incomplete calls and conflicting final sources remain visible in report quality', () => {
  const records = [
    { finalized: false, source: 'webhook', webhook_seen_at: 'now', api_seen_at: null, review_reason: null },
    { finalized: true, source: 'webhook', webhook_seen_at: 'now', api_seen_at: null, review_reason: 'conflict' },
    { finalized: true, source: 'api', webhook_seen_at: null, api_seen_at: 'now', review_reason: null },
  ]
  const quality = summarizeAircall(records, 'API temporarily unavailable')
  assert.equal(quality.pendingCalls, 1)
  assert.equal(quality.reviewCalls, 1)
  assert.equal(quality.webhookRecoveredCalls, 1)
  assert.equal(quality.apiOnlyCalls, 1)
  assert.equal(quality.warnings.length, 3)
})
