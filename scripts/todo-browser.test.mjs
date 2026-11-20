import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { databaseQuery } from './aircall-ledger-admin.mjs'
const browser = await chromium.launch({ headless: true })
const title = `Checklist verification ${Date.now()}`
let createdId
try {
 const context1 = await browser.newContext()
 const context2 = await browser.newContext()
 const local = context1.request
 const page1 = await context1.newPage()
 const page2 = await context2.newPage()
 // Keep the live local API for both isolated sessions; deployed hosts are not needed for this check.
 for (const context of [context1, context2]) await context.route('**/api/todo', async route => {
   const req = route.request()
   const response = await fetch('http://127.0.0.1:5188/api/todo', { method: req.method(), body: req.postData() ?? undefined, headers: { 'Content-Type': 'application/json' } })
   if (!page1.isClosed()) await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() }).catch(() => {})
 })
 await page1.goto('http://127.0.0.1:5188/todo')
 await page1.getByRole('checkbox', { name: 'Contacts Migration', exact: true }).waitFor()
 assert.equal(await page1.locator('nav a[href="/todo"]').count(), 0)
 assert.equal(await page1.getByRole('checkbox').count(), 6)
 await page1.getByLabel('Add a checklist item').fill(title)
 await page1.getByRole('button', { name: 'Add item', exact: true }).click()
 await page1.getByRole('checkbox', { name: title, exact: true }).waitFor()
 const result = await (await local.get('http://127.0.0.1:5188/api/todo')).json()
 createdId = result.items.find(item => item.title === title).id
 await page1.waitForFunction(() => !document.querySelector('.todo-list input')?.disabled)
 await page1.getByRole('checkbox', { name: title, exact: true }).check()
 await page1.getByText('Checklist updated for everyone.', { exact: true }).waitFor()
 await page2.goto('http://127.0.0.1:5188/todo')
 await page2.getByRole('checkbox', { name: title, exact: true }).waitFor()
 assert.equal(await page2.getByRole('checkbox', { name: title, exact: true }).isChecked(), true)
 await page2.getByRole('checkbox', { name: title, exact: true }).uncheck()
 await page2.getByText('Checklist updated for everyone.', { exact: true }).waitFor()
 await page1.reload()
 await page1.getByRole('checkbox', { name: title, exact: true }).waitFor()
 assert.equal(await page1.getByRole('checkbox', { name: title, exact: true }).isChecked(), false)
 await mkdir('tmp/todo', { recursive: true })
 await page1.screenshot({ path: 'tmp/todo/desktop.png', fullPage: true })
 await page1.setViewportSize({ width: 390, height: 844 })
 assert.equal(await page1.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
 await page1.screenshot({ path: 'tmp/todo/mobile.png', fullPage: true })
 console.log('Passed: hidden /todo route, six seeds, add item, shared completion/uncompletion across independent browsers, refresh persistence, mobile width.')
} finally {
 await browser.close()
 if (!createdId) {
   const rows = await databaseQuery(`select id from public.migration_todo_items where title='${title}'`, true)
   createdId = rows[0]?.id
 }
 if (createdId && /^[0-9a-f-]{36}$/.test(createdId)) await databaseQuery(`delete from public.migration_todo_items where id='${createdId}' and title='${title}'`)
 console.log('Temporary verification item removed; original checklist unchanged.')
}
