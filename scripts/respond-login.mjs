import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { chromium } from 'playwright'

const statePath = resolve('.auth/respondio-state.json')
const profilePath = resolve('.auth/respondio-profile')
const isAutoMode = process.argv.includes('--auto')
const isProfileMode = process.argv.includes('--profile')

await mkdir(dirname(statePath), { recursive: true })
await mkdir(profilePath, { recursive: true })

const context = isProfileMode
  ? await chromium.launchPersistentContext(profilePath, { headless: false })
  : await (await chromium.launch({ headless: false })).newContext()
const page = await context.newPage()

await page.goto('https://app.respond.io/space/238284/reports/conversations', {
  waitUntil: 'domcontentloaded',
})

console.log('A browser window is open. Log in to respond.io and open Reports > Conversations.')

if (isProfileMode) {
  console.log('This window will stay open. After login reaches Reports > Conversations, close it.')
  await page.waitForEvent('close', { timeout: 0 })
} else if (isAutoMode) {
  console.log('After Reports > Conversations is visible, click "Save session & close" in the browser.')

  let finishLogin
  const loginFinished = new Promise((resolve) => {
    finishLogin = resolve
  })

  await page.exposeFunction('__saveRespondSession', () => finishLogin())

  // Login redirects and SPA navigation replace the document, so keep adding the
  // control to whichever respond.io page is currently visible.
  const addSaveControl = async () => {
    if (page.isClosed()) return
    await page.evaluate(() => {
      if (document.querySelector('#dharma-save-respond-session')) return
      const button = document.createElement('button')
      button.id = 'dharma-save-respond-session'
      button.type = 'button'
      button.textContent = 'Save session & close'
      button.title = 'Click after Reports > Conversations is fully visible'
      button.style.cssText = [
        'position:fixed', 'right:24px', 'bottom:24px', 'z-index:2147483647',
        'padding:14px 20px', 'border:2px solid #f3cd65', 'border-radius:10px',
        'background:#1c543c', 'color:white', 'font:700 14px system-ui',
        'box-shadow:0 12px 35px rgba(0,0,0,.3)', 'cursor:pointer',
      ].join(';')
      button.addEventListener('click', async () => {
        button.disabled = true
        button.textContent = 'Saving session…'
        await window.__saveRespondSession()
      })
      document.body.appendChild(button)
    }).catch(() => {})
  }

  await addSaveControl()
  const controlTimer = setInterval(addSaveControl, 1000)
  await loginFinished
  clearInterval(controlTimer)
} else {
  console.log('When the report page is visible, come back here and press Enter.')

  const prompt = createInterface({ input, output })
  await prompt.question('')
  prompt.close()
}

await context.storageState({ path: statePath })
await context.close()

console.log(`Saved respond.io browser session to ${statePath}`)
