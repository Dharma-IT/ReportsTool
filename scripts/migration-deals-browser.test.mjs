import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { getMigrationDealMetadata, getMigrationDealPage } from '../api/_lib/migration-deals.js'
const env = loadEnv('development', process.cwd(), '')
const metadata = await getMigrationDealMetadata(env.HUBSPOT_ACCESS_TOKEN)
const live = await getMigrationDealPage(env.HUBSPOT_ACCESS_TOKEN, metadata.pipelines[0].id)
assert.equal(live.rows.every(row => row.length === 12), true)
console.log(JSON.stringify({ livePipelines: metadata.pipelines.map(p => p.label), scanned: live.scanned, selectedPipelineDeals: live.rows.length }))
const browser = await chromium.launch({ headless: true })
try {
 const page = await browser.newPage()
 await page.route('**/api/migration/deals?*', route => {
   const params = new URL(route.request().url()).searchParams
   if (params.get('metadata') === '1') return route.fulfill({ json: { pipelines: [{ id: 'test1', label: 'New leads test' }, { id: 'test2', label: 'Customer Service test' }] } })
   const offset = Number(params.get('after') || 0)
   const count = Math.min(100, 10001 - offset)
   return route.fulfill({ json: { rows: Array.from({ length: count }, () => ['Repeat Buyer', 'Customer Service', '', '13475008081', '', 'Hot', 'PAID', '2026-11-11', 'Agent', '100', '13475008081@dummy.com', '2026-11-11']), scanned: count, missingPhone: 0, missingName: 0, after: offset + count < 10001 ? String(offset + count) : null } })
 })
 await page.goto('http://127.0.0.1:5188/migration')
 await page.getByLabel('Migration type').selectOption('pipelines')
 await page.waitForFunction(() => !document.querySelector('.migration-actions button')?.disabled)
 await page.getByRole('button', { name: 'Prepare pipeline exports', exact: true }).click()
 await page.getByText('All deals processed', { exact: true }).waitFor({ timeout: 60000 })
 assert.equal(await page.getByText('10,001 total exported deals', { exact: true }).count(), 1)
 const downloading = page.waitForEvent('download')
 await page.getByRole('button', { name: 'Download Export 1', exact: true }).click()
 const download = await downloading
 const { readFile } = await import('node:fs/promises')
 const csv = await readFile(await download.path(), 'utf8')
 assert.equal(csv.split('\r\n').length, 10001)
 assert.equal((csv.match(/Repeat Buyer/g) ?? []).length, 10000)
 assert.equal(csv.split('\r\n')[0].split(',').length, 12)
 assert.equal(await page.getByText('1 deals - CSV', { exact: true }).count(), 1)
 await page.getByLabel('HubSpot pipeline').selectOption('test2')
 await page.getByText('No pipeline exports prepared yet').waitFor()
 await page.getByLabel('HubSpot pipeline').selectOption('test1')
 await page.getByText('10,001 total exported deals', { exact: true }).waitFor()
 await page.reload()
 await page.getByLabel('Migration type').selectOption('pipelines')
 await page.getByText('10,001 total exported deals', { exact: true }).waitFor()
 console.log('Browser checks passed: 10k split, repeat purchases preserved, 12 CSV columns, pipeline isolation, refresh resume.')
} finally { await browser.close() }
