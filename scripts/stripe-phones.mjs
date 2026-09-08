import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const profilePath = resolve('.auth/stripe-profile')
if (!existsSync(profilePath)) fail('Stripe Dashboard is not connected. Click Connect Stripe first.')
const ids = (readArg('--ids') ?? '').split(',').filter(Boolean)
const debug = process.argv.includes('--debug')
const context = await chromium.launchPersistentContext(profilePath, { headless: false })
const phones = {}

try {
  let nextIndex = 0
  const worker = async () => {
    const page = await context.newPage()
    while (nextIndex < ids.length) {
      const id = ids[nextIndex++]
    let text = ''
      for (let attempt = 0; attempt < 2 && !/Checkout summary/i.test(text); attempt += 1) {
      await page.goto(`https://dashboard.stripe.com/payments/${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.getByText('Checkout summary', { exact: true }).waitFor({ timeout: 10_000 }).catch(() => {})
      text = await page.locator('body').innerText()
    }
    if (/login|signin/i.test(page.url())) fail('Saved Stripe session expired. Click Connect Stripe and sign in again.')
    if (debug) {
      await page.screenshot({ path: resolve(`.auth/stripe-${id}.png`), fullPage: true })
      console.error(JSON.stringify({ id, url: page.url(), text: text.slice(0, 4000) }))
    }
    const summary = text.match(/Checkout summary([\s\S]{0,1200}?)(?:Items|Payment breakdown|Details)/i)?.[1] ?? text
    const matches = [...summary.matchAll(/(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g)]
    if (matches[0]) phones[id] = `1${matches[0][1]}${matches[0][2]}${matches[0][3]}`
    }
    await page.close()
  }
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker))
  console.log(JSON.stringify({ phones }))
} finally {
  await context.close()
}

function readArg(name) { const arg = process.argv.find((value) => value.startsWith(`${name}=`)); return arg?.slice(name.length + 1) }
function fail(message) { console.error(JSON.stringify({ message })); process.exit(1) }
