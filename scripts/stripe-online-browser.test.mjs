import assert from 'node:assert/strict'
import { chromium } from 'playwright'

// Run Vite on port 5189 before this smoke test. Only the online API is mocked;
// both localhost and deployed-host UI branches render the real application.
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(10_000)
  await page.goto('http://127.0.0.1:5189/ac-automation')
  await page.getByRole('button', { name: 'Connect Stripe', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Connect Stripe online', exact: true }).count(), 0)
  const actions = []
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/stripe-online') {
      const payload = request.postDataJSON()
      actions.push(payload)
      assert.equal(request.headers().authorization, 'Bearer browser-test-administrator-key')
      return route.fulfill({ json: payload.action === 'frame' || payload.action === 'text'
        ? { image: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', width: 1100, height: 760 }
        : { connected: payload.action === 'save', loginOpen: payload.action === 'start' } })
    }
    return route.fulfill({ response: await route.fetch({ url: `http://127.0.0.1:5189${url.pathname}${url.search}` }) })
  })
  await page.goto('http://online.localhost:5189/ac-automation')
  await page.getByRole('button', { name: 'Connect Stripe online', exact: true }).click()
  await page.getByLabel('Online administrator key').fill('browser-test-administrator-key')
  await page.getByRole('button', { name: 'Open Stripe login', exact: true }).click()
  await page.getByRole('img', { name: /Interactive Stripe login/ }).waitFor()
  await page.getByLabel('Text for selected Stripe field').fill('test-login-value')
  await page.getByRole('button', { name: 'Send text', exact: true }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Save online session' && !button.disabled))
  await page.getByRole('button', { name: 'Save online session', exact: true }).click()
  await page.getByText('Online Stripe session saved.', { exact: false }).waitFor()
  assert.equal(await page.getByLabel('Online administrator key').inputValue(), '')
  assert.ok(actions.some(action => action.action === 'text' && action.text === 'test-login-value'))
  assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('browser-test-administrator-key'))), false)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  assert.equal(await page.getByRole('dialog').count(), 0)
  console.log('Stripe UI: local button preserved; online login, polling, input, save and secret clearing passed.')
} finally { await browser.close() }
