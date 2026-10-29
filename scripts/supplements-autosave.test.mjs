import test from 'node:test'
import assert from 'node:assert/strict'
import { createAdsAutosave } from '../src/lib/ads-autosave.ts'
import { saveSupplementsAds, getSupplementsAds } from '../api/_lib/supplements-ads.js'

const tick = () => new Promise((resolve) => setImmediate(resolve))
test('waits five seconds after the last edit and saves dates independently', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const writes = []
  const queue = createAdsAutosave(async (row) => { writes.push(row) }, () => {})
  queue.schedule({ date: '2026-10-27', meta: '10' })
  t.mock.timers.tick(4000)
  queue.schedule({ date: '2026-10-27', meta: '20' })
  queue.schedule({ date: '2026-10-26', meta: '30' })
  t.mock.timers.tick(4999)
  assert.equal(writes.length, 0)
  t.mock.timers.tick(1)
  await tick()
  assert.deepEqual(writes.map((row) => row.meta), ['20', '30'])
  assert.equal(queue.hasPending(), false)
})

test('serializes writes and drains newer edits before View saved can proceed', async () => {
  let release
  const writes = []
  const queue = createAdsAutosave(async (row) => {
    writes.push(row.meta)
    if (writes.length === 1) await new Promise((resolve) => { release = resolve })
  }, () => {}, 60000)
  queue.schedule({ date: '2026-10-27', meta: '10' })
  const first = queue.flushAll()
  queue.schedule({ date: '2026-10-27', meta: '20' })
  const second = queue.flushAll()
  assert.deepEqual(writes, ['10'])
  release()
  assert.equal(await first, true)
  assert.equal(await second, true)
  assert.deepEqual(writes, ['10', '20'])
  assert.equal(queue.hasPending(), false)
})

test('retains failed edits and retries them', async () => {
  let fail = true
  const statuses = []
  const queue = createAdsAutosave(async () => { if (fail) throw new Error('Offline') }, (_, status) => statuses.push(status), 60000)
  queue.schedule({ date: '2026-10-27', meta: '12' })
  assert.equal(await queue.flushAll(), false)
  assert.equal(queue.hasPending(), true)
  assert.equal(statuses.at(-1), 'error')
  fail = false
  assert.equal(await queue.flushAll(), true)
  assert.equal(queue.hasPending(), false)
  assert.equal(statuses.at(-1), 'saved')
})

test('advertising edits persist in the database record and View saved reads them without replacing costs', async (t) => {
  const original = { ...process.env }
  t.after(() => { process.env = original })
  process.env.VITE_SUPABASE_URL = 'https://database.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
  let record = { report_date: '2026-10-27', meta_cost: 1, google_cost: 2, tiktok_cost: 3, cogs: 400, shipping: 100, fulfillment: 20, processing: 30 }
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    assert(String(url).includes('/supplements_ads_reports?'))
    if (init.method === 'POST') {
      const patch = JSON.parse(init.body)
      assert.equal('cogs' in patch, false)
      record = { ...record, ...patch }
    }
    return Response.json([record])
  })
  await saveSupplementsAds({ report_date: '2026-10-27', meta: '50.25', google: '40', tiktok: '0', ads_only: true })
  const saved = (await getSupplementsAds('2026-10-27')).rows[0]
  assert.equal(saved.meta, 50.25)
  assert.equal(saved.google, 40)
  assert.equal(saved.tiktok, 0)
  assert.equal(saved.cogs, 400)
  await assert.rejects(saveSupplementsAds({ report_date: '2026-10-27', meta: 'oops', google: 0, tiktok: 0 }), /valid non-negative/)
})
