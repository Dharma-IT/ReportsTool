import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const profilePath = resolve('.auth/stripe-profile')
if (!existsSync(profilePath)) fail('Stripe Dashboard is not connected. Click Connect Stripe first.')
const ids = (readArg('--ids') ?? '').split(',').filter(Boolean)
const debug = process.argv.includes('--debug')
const headless = process.argv.includes('--headless')
const context = await chromium.launchPersistentContext(profilePath, { headless })
const phones = {}

try {
  let nextIndex = 0
  const worker = async () => {
    const page = await context.newPage()
    while (nextIndex < ids.length) {
      const id = ids[nextIndex++]
      let text = ''
      try {
        // Stripe is a long-lived SPA and frequently never reaches
        // `domcontentloaded`. `commit` confirms navigation without waiting for
        // every Dashboard request to settle.
        await page.goto(`https://dashboard.stripe.com/payments/${encodeURIComponent(id)}`, { waitUntil: 'commit', timeout: 20_000 })
        await page.getByText('Checkout summary', { exact: true }).waitFor({ timeout: 15_000 }).catch(() => {})
        await page.waitForTimeout(1_000)
        text = await page.locator('body').innerText()
        if (/login|signin/i.test(page.url())) fail('Saved Stripe session expired. Click Connect Stripe and sign in again.')
        if (debug) {
          await page.screenshot({ path: resolve(`.auth/stripe-${id}.png`), fullPage: true })
          console.error(JSON.stringify({ id, url: page.url(), text: text.slice(0, 4000) }))
        }
        const summary = text.match(/Checkout summary([\s\S]{0,1600}?)(?:Items|Payment breakdown|Details)/i)?.[1] ?? text
        const matches = [...summary.matchAll(/(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g)]
        if (matches[0]) phones[id] = `1${matches[0][1]}${matches[0][2]}${matches[0][3]}`
      } catch (error) {
        if (debug) console.error(JSON.stringify({ id, message: error instanceof Error ? error.message : String(error) }))
      }
    }
    await page.close()
  }
  await Promise.all(Array.from({ length: Math.min(6, ids.length) }, worker))
  console.log(JSON.stringify({ phones }))
} finally {
  await context.close()
}

function readArg(name) { const arg = process.argv.find((value) => value.startsWith(`${name}=`)); return arg?.slice(name.length + 1) }
function fail(message) { console.error(JSON.stringify({ message })); process.exit(1) }
