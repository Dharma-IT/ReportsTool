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
let loginPages = 0

try {
  const runBatch = async (batch) => {
    let nextIndex = 0
    const worker = async () => {
      let page
      try {
        page = await context.newPage()
        while (nextIndex < batch.length) {
          const { id, testMode } = batch[nextIndex++]
          let text = ''
          try {
        // Stripe is a long-lived SPA and frequently never reaches
        // `domcontentloaded`. `commit` confirms navigation without waiting for
        // every Dashboard request to settle.
        const modePath = testMode ? 'test/' : ''
        await page.goto(`https://dashboard.stripe.com/${modePath}payments/${encodeURIComponent(id)}`, { waitUntil: 'commit', timeout: 20_000 })
        // Stripe's test-mode route can briefly render an empty application
        // shell. Poll for real content without depending on a specific label.
        for (let attempt = 0; attempt < 15; attempt += 1) {
          await page.waitForTimeout(1_000)
          text = await page.locator('body').innerText()
          if (text.includes(id) || /checkout summary|transaction not found|payment details/i.test(text)) break
        }
        const loginRoute = /\/(?:login|signin)(?:[/?#]|$)/i.test(new URL(page.url()).pathname)
        const loginScreen = /sign in to (?:your )?stripe|email address[\s\S]{0,200}password/i.test(text)
        if (loginRoute && loginScreen) {
          loginPages += 1
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
    // Six tabs keep a full date crawl below the API timeout. The previous
    // failure came from crawling every unresolved payment twice.
    await Promise.all(Array.from({ length: Math.min(6, batch.length) }, worker))
  }
  await runBatch(targets)
  if (targets.length && loginPages === targets.length) {
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
