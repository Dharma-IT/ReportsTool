import assert from 'node:assert/strict'
import { mkdtemp, readFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { createOnlineStripe } from '../api/_lib/stripe-online.ts'

const root = await mkdtemp(join(tmpdir(), 'stripe-online-test-'))
const key = '1234'
const originalLaunch = chromium.launchPersistentContext
const launches = []
const entered = []
let location = 'https://dashboard.stripe.com/payments'
let deferredFrame
let expired = false
let noPhone = false
const page = {
  isClosed: () => false,
  goto: async url => { location = expired ? 'https://dashboard.stripe.com/login' : url },
  url: () => location,
  waitForURL: async predicate => assert.ok(predicate(new URL(location))),
  getByRole: () => ({ or() { return this }, first() { return this }, waitFor: async () => {} }),
  screenshot: async () => { if (deferredFrame) await deferredFrame; return Buffer.from('fake-image') },
  keyboard: { insertText: async text => entered.push(text), press: async () => {} },
  mouse: { click: async () => {}, wheel: async () => {} },
  waitForTimeout: async () => {},
  locator: () => ({ innerText: async () => noPhone ? 'Checkout summary Customer Items' : 'Checkout summary Customer +1 (212) 555-0123 Items' }),
}
chromium.launchPersistentContext = async (profile, options) => {
  launches.push({ profile, options })
  return { pages: () => [page], close: async () => {} }
}
let handler
const service = createOnlineStripe({ enabled: true, dataDir: root, adminKey: key })
const server = createServer((req, res) => handler(req, res))
service.plugin.configureServer({ middlewares: { use: (_path, callback) => { handler = callback } }, httpServer: server })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/api/stripe-online`
const request = (action, extra = {}, token = key) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ action, ...extra }),
})
try {
  assert.equal((await request('start', {}, 'wrong')).status, 401)
  assert.equal(launches.length, 0, 'unauthorized requests cannot open a browser')
  assert.match((await service.crawl(['pi_abc'])).warning, /Connect Stripe online/)
  assert.equal((await request('start')).status, 200)
  assert.equal(launches[0].profile, join(root, 'online-profile'))
  assert.equal(launches[0].options.headless, true)
  assert.match((await service.crawl(['pi_abc'])).warning, /busy/)
  assert.equal((await request('click', { x: -1, y: 12 })).status, 400)
  assert.equal((await request('key', { key: 'arbitrary' })).status, 400)
  const secret = 'credential-that-must-not-be-echoed'
  const textResponse = await request('text', { text: secret })
  assert.equal(textResponse.status, 200)
  assert.ok(!(await textResponse.text()).includes(secret))
  assert.deepEqual(entered, [secret])
  let release
  deferredFrame = new Promise(resolve => { release = resolve })
  const pending = request('frame')
  // Wait until the in-flight HTTP request has taken the browser lock.
  let status
  for (let i = 0; i < 50; i++) {
    status = (await request('status')).status
    if (status === 409) break
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.equal(status, 409)
  release()
  assert.equal((await pending).status, 200)
  deferredFrame = undefined
  assert.equal((await request('save')).status, 200)
  assert.ok(JSON.parse(await readFile(join(root, 'online-session-ready.json'), 'utf8')).connectedAt)
  assert.deepEqual(await service.crawl(['pi_abc', 'test:pi_def', '../invalid']), {
    phones: { pi_abc: '12125550123', pi_def: '12125550123' }, warning: '', pending: 0, estimatedSeconds: 0,
  })
  assert.ok(location.includes('/test/payments/pi_def'))
  const beforeCached = launches.length
  assert.equal((await service.crawl(['pi_abc', 'test:pi_def'])).pending, 0)
  assert.equal(launches.length, beforeCached, 'cached phone numbers do not relaunch Chromium')
  const many = ['pi_a1', 'pi_a2', 'pi_a3', 'pi_a4', 'pi_a5', 'pi_a6', 'pi_a7']
  const firstBatch = await service.crawl(many)
  assert.equal(firstBatch.pending, 4)
  assert.ok(firstBatch.estimatedSeconds > 0, 'queued attempts include a remaining-time estimate')
  assert.equal(Object.keys(firstBatch.phones).length, 3)
  assert.equal((await service.crawl(many)).pending, 1)
  const lastBatch = await service.crawl(many)
  assert.equal(lastBatch.pending, 0)
  assert.equal(Object.keys(lastBatch.phones).length, 7, 'all prior batch results survive continuation')
  const restarted = createOnlineStripe({ enabled: true, dataDir: root, adminKey: key })
  assert.equal(Object.keys((await restarted.crawl(many)).phones).length, 7, 'saved results survive service recreation')
  noPhone = true
  const missing = ['pi_missing1', 'pi_missing2', 'pi_missing3', 'pi_missing4']
  assert.equal((await service.crawl(missing)).pending, 4)
  assert.equal((await service.crawl(missing)).pending, 2)
  assert.equal((await service.crawl(missing)).pending, 0, 'missing phones stop retrying after two attempts')
  const beforeCooldown = launches.length
  assert.equal((await service.crawl(missing)).pending, 0)
  assert.equal(launches.length, beforeCooldown, 'unavailable phones do not consume every subsequent Apply')
  noPhone = false
  expired = true
  assert.match((await service.crawl(['pi_expired'])).warning, /expired/)
  await assert.rejects(access(join(root, 'online-session-ready.json')))
  const disabled = createOnlineStripe({ enabled: false, dataDir: root, adminKey: key })
  assert.match((await disabled.crawl(['pi_abc'])).warning, /not configured/)
  assert.ok(launches.every(item => item.profile === join(root, 'online-profile')))
  console.log('Online Stripe: authorization, profile isolation, login/save, controls, locking, recovery, test mode and expiry passed.')
} finally {
  await request('close').catch(() => {})
  await new Promise(resolve => server.close(resolve))
  chromium.launchPersistentContext = originalLaunch
  await rm(root, { recursive: true, force: true })
}
