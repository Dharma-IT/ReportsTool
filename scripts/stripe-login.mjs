import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const profilePath = resolve('.auth/stripe-profile')
const readyPath = resolve('.auth/stripe-session-ready.json')
await mkdir(profilePath, { recursive: true })
await rm(readyPath, { force: true })
const context = await chromium.launchPersistentContext(profilePath, { headless: false })
const page = await context.newPage()
await page.goto('https://dashboard.stripe.com/payments', { waitUntil: 'domcontentloaded' })
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
await context.close()
await writeFile(readyPath, JSON.stringify({ connectedAt: new Date().toISOString() }))
