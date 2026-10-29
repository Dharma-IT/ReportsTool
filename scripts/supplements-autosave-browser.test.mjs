import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.error(error.message))
  page.setDefaultTimeout(10000)
  let saved = { report_date: '2026-10-27', meta: 10, google: 20, tiktok: 30 }
  const writes = []
  let fail = false
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/_lib/')) return route.continue()
    let payload = { rows: [] }
    if (url.pathname === '/api/supplements/ads') {
      if (request.method() === 'POST') {
        if (fail) return route.fulfill({ status: 502, json: { message: 'Simulated offline save' } })
        writes.push(request.postDataJSON())
        saved = { ...saved, ...request.postDataJSON() }
      }
      payload = { rows: [saved], row: saved }
    } else if (url.searchParams.has('month')) {
      payload = { monthly: { sales: 1000, qty: 1, shopifySales: 1000, shopifyQty: 1, tiktokSales: 0, tiktokQty: 0,
        meta: Number(saved.meta), google: Number(saved.google), tiktok: Number(saved.tiktok), cogs: 0, shipping: 0, fulfillment: 0, processingSupliful: 0, processingShopify: 0 } }
    } else if (url.pathname === '/api/shopify/sales' && !url.searchParams.has('dates')) {
      payload = { rows: [{ id: '1', qty: 1, total_sales: 1000, sales_channel: 'web' }] }
    }
    return route.fulfill({ json: payload })
  })
  await page.goto('http://127.0.0.1:5188/supplements')
  await page.locator('#supplements-date').fill('2026-10-27')
  await page.getByRole('button', { name: 'View saved', exact: true }).click()
  await page.getByText('Saved sales, ADS data', { exact: false }).waitFor()
  await page.getByRole('button', { name: /ADS Advertising spend/ }).click()
  const meta = page.getByRole('textbox', { name: 'Meta 2026-10-27', exact: true })
  await meta.fill('50')
  await page.waitForTimeout(3000)
  await meta.fill('60')
  await page.waitForTimeout(2500)
  assert.equal(writes.length, 0)
  await page.getByText('2026-10-27: Saved', { exact: true }).waitFor()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].meta, '60')
  await page.getByRole('button', { name: /Report Daily Daily finance/ }).click()
  assert.match(await page.getByRole('row').filter({ hasText: 'Meta Ads' }).innerText(), /\$60\.00/)
  assert.match(await page.getByRole('row').filter({ hasText: 'Net Profit Daily' }).innerText(), /\$890\.00/)
  assert.match(await page.getByRole('row').filter({ hasText: 'Net Profit Monthly' }).innerText(), /\$890\.00/)
  await page.getByRole('button', { name: 'View saved', exact: true }).click()
  await page.getByText('Saved sales, ADS data', { exact: false }).waitFor()
  assert.match(await page.getByRole('row').filter({ hasText: 'Meta Ads' }).innerText(), /\$60\.00/)
  await page.getByRole('button', { name: /ADS Advertising spend/ }).click()
  fail = true
  await meta.fill('70')
  await page.getByText('Simulated offline save', { exact: false }).waitFor()
  assert.equal(saved.meta, '60')
  assert.equal(await meta.inputValue(), '70')
  fail = false
  await page.getByRole('button', { name: 'Retry save' }).click()
  await page.getByText('2026-10-27: Saved', { exact: true }).waitFor()
  assert.equal(saved.meta, '70')
  await page.reload()
  await page.locator('#supplements-date').fill('2026-10-27')
  await page.getByRole('button', { name: 'View saved', exact: true }).click()
  await page.getByText('Saved sales, ADS data', { exact: false }).waitFor()
  assert.match(await page.getByRole('row').filter({ hasText: 'Meta Ads' }).innerText(), /\$70\.00/)
  console.log('Browser checks passed: debounce, daily/monthly totals, View saved, retry, reload persistence; API mocked.')
} finally { await browser.close() }
