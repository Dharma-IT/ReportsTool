const GOOGLE_ADS_API_VERSION = 'v25'

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnvironment('GOOGLE_ADS_CLIENT_ID'),
      client_secret: requiredEnvironment('GOOGLE_ADS_CLIENT_SECRET'),
      refresh_token: requiredEnvironment('GOOGLE_ADS_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google Ads authentication failed: ${payload.error_description || payload.error || response.status}`)
  }
  return payload.access_token
}

export async function fetchGoogleAdsCost(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD.')
  const customerId = requiredEnvironment('GOOGLE_ADS_CUSTOMER_ID').replace(/\D/g, '')
  const accessToken = await getAccessToken()
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, '')
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  if (developerToken) headers['developer-token'] = developerToken
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date = '${date}'`,
      }),
    },
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.error?.message || `request failed (${response.status})`
    throw new Error(`Google Ads reporting failed: ${detail}`)
  }
  const costMicros = (Array.isArray(payload) ? payload : []).reduce((total, batch) => (
    total + (batch.results ?? []).reduce((sum, row) => sum + Number(row.metrics?.costMicros ?? 0), 0)
  ), 0)
  return { date, cost: Math.round((costMicros / 1_000_000) * 100) / 100, currencyCode: 'USD' }
}
