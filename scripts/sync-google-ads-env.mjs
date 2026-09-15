import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const credentials = JSON.parse(
  await readFile(resolve('.auth/google-ads-oauth.json'), 'utf8'),
)
const token = JSON.parse(await readFile(resolve('.auth/google-ads-token.json'), 'utf8'))
const client = credentials.installed ?? credentials.web

if (!client?.client_id || !client?.client_secret || !token?.refresh_token) {
  throw new Error('Google Ads OAuth credentials are incomplete.')
}

const envPath = resolve('.env.local')
let env = await readFile(envPath, 'utf8')
const values = {
  GOOGLE_ADS_CLIENT_ID: client.client_id,
  GOOGLE_ADS_CLIENT_SECRET: client.client_secret,
  GOOGLE_ADS_REFRESH_TOKEN: token.refresh_token,
  GOOGLE_ADS_CUSTOMER_ID: '7165793519',
}

for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${value}`
  const pattern = new RegExp(`^${name}=.*$`, 'm')
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`
}

await writeFile(envPath, env, 'utf8')
console.log(`Added ${Object.keys(values).join(', ')} to .env.local.`)
