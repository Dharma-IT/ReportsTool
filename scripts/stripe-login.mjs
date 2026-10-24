import { mkdir, open, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const profilePath = resolve('.auth/stripe-profile')
const readyPath = resolve('.auth/stripe-session-ready.json')
const lockPath = resolve('.auth/stripe-login.lock')
await mkdir(profilePath, { recursive: true })
await rm(readyPath, { force: true })
let lock
try {
  lock = await open(lockPath, 'wx')
} catch {
  throw new Error('A Stripe login window is already open. Use that window or close it before trying again.')
}

let context
try {
  context = await chromium.launchPersistentContext(profilePath, { headless: false })
  const page = await context.newPage()
  await page.goto('https://dashboard.stripe.com/payments', { waitUntil: 'commit', timeout: 30_000 })
  console.log('Log in to Stripe. When the Payments page is visible, click Save Stripe session & close.')

  let finish
  const finished = new Promise((resolveFinished) => { finish = resolveFinished })
  await page.exposeFunction('__saveDharmaStripeSession', () => finish())
  const addButton = async () => {
  if (page.isClosed()) return
  await page.evaluate(() => {
    // Stripe prefixes dashboard routes with the account id and/or mode (for
    // example /acct_123/payments or /test/payments). Requiring the pathname to
    // start with /payments caused the button to be removed as soon as Stripe's
    // initial SPA redirect completed.
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const authenticatedPaymentsPage = location.hostname === 'dashboard.stripe.com' && pathSegments.includes('payments')
    if (!authenticatedPaymentsPage) {
      document.querySelector('#dharma-save-stripe-session')?.remove()
      return
    }
    if (document.querySelector('#dharma-save-stripe-session')) return
    const button = document.createElement('button')
    button.id = 'dharma-save-stripe-session'
    button.textContent = 'Save Stripe session & close'
    button.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;padding:14px 20px;border:2px solid #f3cd65;border-radius:10px;background:#1c543c;color:white;font:700 14px system-ui;box-shadow:0 12px 35px rgba(0,0,0,.3);cursor:pointer'
    button.onclick = async () => { button.disabled = true; button.textContent = 'Saving...'; await window.__saveDharmaStripeSession() }
    // Mount outside Stripe's React-owned body subtree where possible. The
    // dashboard frequently replaces body descendants while it initializes.
    ;(document.documentElement || document.body).appendChild(button)
  }).catch(() => {})
  }
  await addButton()
  // Keep restoring the control after client-side navigation or a dashboard
  // re-render. A short interval avoids a noticeable disappear/reappear flash.
  const timer = setInterval(addButton, 250)
  await finished
  clearInterval(timer)

  const cookies = await context.cookies('https://dashboard.stripe.com')
  if (!cookies.length || /login|signin/i.test(page.url())) {
    throw new Error('Stripe is not signed in yet. Finish signing in before saving the session.')
  }
  // Closing the persistent context flushes cookies and local storage to disk.
  await context.close()
  context = undefined
  await writeFile(readyPath, JSON.stringify({ connectedAt: new Date().toISOString(), cookieCount: cookies.length }))
} catch (error) {
  if (error instanceof Error && !/Target page, context or browser has been closed/i.test(error.message)) {
    console.error(JSON.stringify({ message: error.message }))
  }
  process.exitCode = 1
} finally {
  await context?.close().catch(() => {})
  await lock?.close().catch(() => {})
  await rm(lockPath, { force: true })
}
