let cachedToken = null
let cachedShopify2Token = null

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function shopifyStoreDomain() {
  const value = requiredEnvironment('SHOPIFY_STORE_DOMAIN')
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(value)) {
    throw new Error('SHOPIFY_STORE_DOMAIN must be a *.myshopify.com hostname')
  }

  return value
}

/**
 * Exchanges server-side app credentials for a short-lived Admin API token.
 * Tokens are cached in memory until one minute before Shopify says they expire.
 */
export async function getShopifyAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken?.expiresAt > Date.now()) return cachedToken.value

  const response = await fetch(`https://${shopifyStoreDomain()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: requiredEnvironment('SHOPIFY_CLIENT_ID'),
      client_secret: requiredEnvironment('SHOPIFY_CLIENT_SECRET'),
    }),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || 'credential exchange failed'
    throw new Error(`Shopify authentication failed (${response.status}): ${detail}`)
  }

  const expiresIn = Number(payload.expires_in) || 86400
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000,
  }
  return cachedToken.value
}

export async function shopifyAdminFetch(path, options = {}) {
  const version = requiredEnvironment('SHOPIFY_API_VERSION')
  const normalizedPath = String(path).replace(/^\//, '')
  const makeRequest = (token) => fetch(
    `https://${shopifyStoreDomain()}/admin/api/${version}/${normalizedPath}`,
    {
      ...options,
      headers: {
        Accept: 'application/json',
        'X-Shopify-Access-Token': token,
        ...options.headers,
      },
    },
  )

  let response = await makeRequest(await getShopifyAccessToken())
  if (response.status === 401) {
    response = await makeRequest(await getShopifyAccessToken({ forceRefresh: true }))
  }
  return response
}

export async function shopify2AdminFetch(path, options = {}) {
  const clientId = requiredEnvironment('SHOPIFY2_CLIENT_ID')
  const clientSecret = requiredEnvironment('SHOPIFY2_CLIENT_SECRET')
  const getToken = async (forceRefresh = false) => {
    if (!forceRefresh && cachedShopify2Token?.expiresAt > Date.now()) return cachedShopify2Token.value
    const response = await fetch(`https://${shopifyStoreDomain()}/admin/oauth/access_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.access_token) throw new Error(`Shopify payouts authentication failed (${response.status}): ${payload.error_description || payload.error || 'credential exchange failed'}`)
    const expiresIn = Number(payload.expires_in) || 86400
    cachedShopify2Token = { value: payload.access_token, expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000 }
    return cachedShopify2Token.value
  }
  const version = requiredEnvironment('SHOPIFY_API_VERSION')
  const normalizedPath = String(path).replace(/^\//, '')
  const makeRequest = (token) => fetch(`https://${shopifyStoreDomain()}/admin/api/${version}/${normalizedPath}`, {
    ...options,
    headers: { Accept: 'application/json', 'X-Shopify-Access-Token': token, ...options.headers },
  })
  let response = await makeRequest(await getToken())
  if (response.status === 401) response = await makeRequest(await getToken(true))
  return response
}
