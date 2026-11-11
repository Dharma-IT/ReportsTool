import { chromium, type BrowserContext, type Page } from 'playwright'
import { mkdir, access, writeFile, unlink } from 'node:fs/promises'
import { resolve, isAbsolute } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import type { Plugin } from 'vite'

type Options = { enabled: boolean; dataDir: string; adminKey: string }
type Recovery = { phones: Record<string, string>; warning: string }
const viewport = { width: 1100, height: 760 }

// This service owns only its dedicated online profile. Local Stripe scripts and
// .auth/stripe-profile are deliberately never used here.
export function createOnlineStripe(options: Options) {
  const root = options.dataDir ? resolve(options.dataDir) : ''
  const marker = resolve(root || '.', 'online-session-ready.json')
  let context: BrowserContext | undefined
  let page: Page | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let busy = false
  const configured = options.enabled && isAbsolute(options.dataDir) && options.adminKey.length >= 32
  const close = async () => {
    clearTimeout(idleTimer)
    const previous = context
    context = undefined
    page = undefined
    await previous?.close()
  }
  const touch = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => { if (!busy) void close().catch(() => {}) }, 10 * 60_000)
    idleTimer.unref()
  }
  const connected = async () => { try { await access(marker); return true } catch { return false } }
  const launch = async () => {
    await mkdir(root, { recursive: true, mode: 0o700 })
    return chromium.launchPersistentContext(resolve(root, 'online-profile'), {
      headless: true, viewport, acceptDownloads: false,
      args: ['--disable-dev-shm-usage'],
    })
  }
  const verify = async () => {
    if (!page || page.isClosed()) throw new Error('Open the online Stripe login first.')
    await page.goto('https://dashboard.stripe.com/payments', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForURL(url => url.hostname === 'dashboard.stripe.com' && url.pathname.split('/').includes('payments'), { timeout: 15_000 })
    // Check authenticated content as well as the URL; the local marker alone
    // is never treated as proof that a new online login succeeded.
    await page.getByRole('button', { name: /create payment/i }).or(page.getByRole('link', { name: /^customers$/i })).first().waitFor({ timeout: 15_000 })
    await close() // flush the persistent profile before publishing readiness
    await writeFile(marker, JSON.stringify({ connectedAt: new Date().toISOString() }), { mode: 0o600 })
  }

  const plugin: Plugin = {
    name: 'stripe-online-session',
    configureServer(server) {
      server.httpServer?.once('close', () => { void close().catch(() => {}) })
      server.middlewares.use('/api/stripe-online', async (request, response) => {
        response.setHeader('Cache-Control', 'no-store')
        const send = (status: number, payload: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(payload))
        }
        if (!configured) return send(503, { message: 'Online Stripe requires STRIPE_ONLINE_ENABLED=true, an absolute STRIPE_ONLINE_DATA_DIR on a persistent disk, and STRIPE_ONLINE_ADMIN_KEY (at least 32 characters).' })
        const supplied = Buffer.from((request.headers.authorization || '').replace(/^Bearer /, ''))
        const expected = Buffer.from(options.adminKey)
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { message: 'Enter the online Stripe administrator key.' })
        if (request.method !== 'POST') return send(405, { message: 'Use POST.' })
        if (busy) return send(409, { message: 'Stripe browser is busy. Try again shortly.' })
        busy = true
        try {
          let raw = ''
          for await (const chunk of request) {
            raw += chunk.toString()
            if (Buffer.byteLength(raw) > 16_384) return send(413, { message: 'Request too large.' })
          }
          const input = JSON.parse(raw || '{}')
          switch (input.action) {
            case 'status': return send(200, { connected: await connected(), loginOpen: Boolean(page) })
            case 'start': {
              if (!context) {
                await unlink(marker).catch(() => {})
                context = await launch()
                page = context.pages()[0] || await context.newPage()
                await page.goto('https://dashboard.stripe.com/payments', { waitUntil: 'commit', timeout: 30_000 })
              }
              touch()
              return send(200, { loginOpen: true })
            }
            case 'close': await close(); return send(200, { connected: await connected() })
            case 'save': await verify(); return send(200, { connected: true })
            case 'frame':
            case 'click':
            case 'text':
            case 'key':
            case 'scroll': {
              if (!page || page.isClosed()) return send(409, { message: 'Online login closed. Open it again.' })
              if (input.action !== 'frame') touch()
              if (input.action === 'click') {
                if (!Number.isFinite(input.x) || !Number.isFinite(input.y) || input.x < 0 || input.x > viewport.width || input.y < 0 || input.y > viewport.height) return send(400, { message: 'Invalid coordinates.' })
                await page.mouse.click(input.x, input.y)
              }
              if (input.action === 'text') {
                if (typeof input.text !== 'string' || input.text.length > 4096) return send(400, { message: 'Invalid text.' })
                await page.keyboard.insertText(input.text)
              }
              if (input.action === 'key') {
                if (!['Tab', 'Shift+Tab', 'Enter', 'Backspace', 'Control+A', 'Escape'].includes(input.key)) return send(400, { message: 'Invalid key.' })
                await page.keyboard.press(input.key)
              }
              if (input.action === 'scroll') await page.mouse.wheel(0, input.direction === 'up' ? -500 : 500)
              return send(200, { image: `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 65, timeout: 10_000 })).toString('base64')}`, ...viewport })
            }
            default: return send(400, { message: 'Unknown online Stripe action.' })
          }
        } catch {
          // Never expose browser errors that could contain credentials or URLs.
          return send(502, { message: 'Online Stripe action failed. Refresh the view, finish login/MFA, or reopen the online session. Check that Chromium is installed on Render.' })
        } finally { busy = false }
      })
    },
  }

  const crawl = async (ids: string[]): Promise<Recovery> => {
    if (!ids.length) return { phones: {}, warning: '' }
    if (!configured) return { phones: {}, warning: 'Online Stripe crawling is not configured.' }
    if (busy || context) return { phones: {}, warning: 'Online Stripe browser is busy. Save or close online login, then retry Apply.' }
    if (!await connected()) return { phones: {}, warning: 'Connect Stripe online and save the session first.' }
    busy = true
    const phones: Record<string, string> = {}
    let browser: BrowserContext | undefined
    let warning = ''
    try {
      browser = await launch()
      const tab = browser.pages()[0] || await browser.newPage()
      const deadline = Date.now() + 150_000
      for (const target of ids) {
        if (Date.now() >= deadline) { warning = 'Online crawl reached its time limit. Some phone numbers remain unresolved.'; break }
        const test = target.startsWith('test:')
        const id = test ? target.slice(5) : target
        if (!/^(pi|ch|py)_[A-Za-z0-9]+$/.test(id)) continue
        try {
          await tab.goto(`https://dashboard.stripe.com/${test ? 'test/' : ''}payments/${id}`, { waitUntil: 'commit', timeout: 20_000 })
          for (let attempt = 0; attempt < 25 && Date.now() < deadline; attempt++) {
            await tab.waitForTimeout(1000)
            const text = await tab.locator('body').innerText({ timeout: 5000 })
            if (/\/(login|signin)(?:[/?#]|$)/i.test(new URL(tab.url()).pathname)) {
              await unlink(marker).catch(() => {})
              warning = 'Online Stripe session expired. Reconnect Stripe online.'
              break
            }
            const summary = text.match(/Checkout summary([\s\S]{0,1600}?)(?:Items|Payment breakdown|Details)/i)?.[1]
            const match = summary?.match(/(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/)
            if (match) { phones[id] = `1${match[1]}${match[2]}${match[3]}`; break }
            if (/transaction not found/i.test(text)) break
          }
          if (warning) break
        } catch { warning = 'Some online Stripe payment pages could not be read.' }
      }
      return { phones, warning }
    } catch { return { phones, warning: 'Unable to start online Stripe browser. Check the Render Chromium installation and disk configuration.' } }
    finally { await browser?.close().catch(() => {}); busy = false }
  }
  return { plugin, crawl }
}
