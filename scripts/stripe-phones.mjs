import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const profilePath = resolve('.auth/stripe-profile')
if (!existsSync(profilePath)) fail('Stripe Dashboard is not connected. Click Connect Stripe first.')
const targets = (readArg('--ids') ?? '').split(',').filter(Boolean).map((value) => {
  const testMode = value.startsWith('test:')
  return { id: testMode ? value.slice(5) : value, testMode }
})
const debug = process.argv.includes('--debug')
const headless = process.argv.includes('--headless')
const context = await chromium.launchPersistentContext(profilePath, { headless })
const phones = {}
const loginPages = new Set()
const deadline = Date.now() + 150_000

try {
  const runBatch = async (batch, concurrency = 6) => {
    let nextIndex = 0
    const worker = async () => {
      let page
      try {
        page = await context.newPage()
        while (nextIndex < batch.length) {
          if (Date.now() >= deadline) break
          const { id, testMode } = batch[nextIndex++]
          let text = ''
          try {
        // Stripe is a long-lived SPA and frequently never reaches
        // `domcontentloaded`. `commit` confirms navigation without waiting for
        // every Dashboard request to settle.
        const modePath = testMode ? 'test/' : ''
        await page.goto(`https://dashboard.stripe.com/${modePath}payments/${encodeURIComponent(id)}`, { waitUntil: 'commit', timeout: 20_000 })
        // The payment ID renders before Checkout summary's customer details.
        // Keep waiting for the phone instead of treating that early shell as
        // a completed lookup (which made the same contact succeed on retry).
        for (let attempt = 0; attempt < 25 && Date.now() < deadline; attempt += 1) {
          await page.waitForTimeout(1_000)
          text = await page.locator('body').innerText()
          const summary = text.match(/Checkout summary([\s\S]{0,1600}?)(?:Items|Payment breakdown|Details)/i)?.[1]
          if (summary && /(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(summary)) break
          if (/transaction not found|sign in to (?:your )?stripe/i.test(text)) break
        }
        const loginRoute = /\/(?:login|signin)(?:[/?#]|$)/i.test(new URL(page.url()).pathname)
        const loginScreen = /sign in to (?:your )?stripe|email address[\s\S]{0,200}password/i.test(text)
        if (loginRoute && loginScreen) {
          loginPages.add(id)
          continue
        }
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
      } catch (error) {
        if (debug) console.error(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }))
      } finally {
        await page?.close().catch(() => {})
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, worker))
  }
  await runBatch(targets)
  // Retry only unresolved payment pages with fewer tabs. The Dashboard can
  // return a partial SPA shell under load even with a valid saved session.
  // One shared deadline keeps both passes below the caller's 180s timeout.
  const retry = targets.filter(({ id }) => !phones[id] && /^(?:pi|ch|py)_/.test(id))
  if (loginPages.size !== targets.length && retry.length && Date.now() < deadline) await runBatch(retry, 3)
  if (targets.length && loginPages.size === targets.length) {
    console.error(JSON.stringify({ message: 'Saved Stripe session expired. Click Connect Stripe and sign in again.' }))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({ phones }))
  }
} finally {
  await context.close()
}

function readArg(name) { const arg = process.argv.find((value) => value.startsWith(`${name}=`)); return arg?.slice(name.length + 1) }
function fail(message) { console.error(JSON.stringify({ message })); process.exit(1) }
