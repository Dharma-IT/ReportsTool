const META_GRAPH_VERSION = 'v20.0'

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export async function fetchMetaAdsCost(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD.')
  const account = requiredEnvironment('AD_ACCOUNT_ID').replace(/^act_/i, '').replace(/\D/g, '')
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${account}/insights`)
  url.search = new URLSearchParams({
    access_token: requiredEnvironment('META_USER_TOKEN'),
    fields: 'spend,account_currency',
    level: 'account',
    time_range: JSON.stringify({ since: date, until: date }),
  }).toString()
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.error) {
    throw new Error(`Meta Ads reporting failed: ${payload.error?.message || `request failed (${response.status})`}`)
  }
  const result = payload.data?.[0]
  return {
    date,
    cost: Math.round(Number(result?.spend ?? 0) * 100) / 100,
    currencyCode: result?.account_currency || 'USD',
  }
}
