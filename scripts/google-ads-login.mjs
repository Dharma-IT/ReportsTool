import { createServer } from 'node:http'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { chromium } from 'playwright'

const credentialsArg = process.argv.find((arg) => arg.startsWith('--credentials='))
const credentialsPath = resolve(credentialsArg?.slice('--credentials='.length) ?? '')
if (!credentialsArg) {
  throw new Error('Pass the downloaded OAuth JSON with --credentials=<path>.')
}

const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'))
const client = credentials.installed ?? credentials.web
if (!client?.client_id || !client?.client_secret) {
  throw new Error('The selected file is not a valid Google OAuth client JSON file.')
}

const authDir = resolve('.auth')
const savedCredentialsPath = resolve(authDir, 'google-ads-oauth.json')
const tokenPath = resolve(authDir, 'google-ads-token.json')
await mkdir(dirname(tokenPath), { recursive: true })
await copyFile(credentialsPath, savedCredentialsPath)

let finishCallback
const callbackResult = new Promise((resolveCallback, rejectCallback) => {
  finishCallback = { resolve: resolveCallback, reject: rejectCallback }
})

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  response.writeHead(error || !code ? 400 : 200, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(error ? `Authorization failed: ${error}` : 'Authorization complete. You may close this window.')
  if (error) finishCallback.reject(new Error(`Google authorization failed: ${error}`))
  else if (code) finishCallback.resolve(code)
})

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('Unable to start OAuth callback server.')
const redirectUri = `http://127.0.0.1:${address.port}`

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
authUrl.search = new URLSearchParams({
  client_id: client.client_id,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/adwords',
  access_type: 'offline',
  prompt: 'consent',
}).toString()

console.log(`Opening Google authorization using ${basename(credentialsPath)}.`)
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage()
await page.goto(authUrl.toString())

try {
  const code = await callbackResult
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const token = await tokenResponse.json()
  if (!tokenResponse.ok || !token.refresh_token) {
    throw new Error(token.error_description ?? token.error ?? 'Google did not return a refresh token.')
  }
  await writeFile(tokenPath, JSON.stringify(token, null, 2), 'utf8')
  console.log(`Google Ads authorization saved to ${tokenPath}`)
} finally {
  server.close()
  await browser.close()
}
