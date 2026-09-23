function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function supabaseRestUrl() {
  const configured = process.env.VITE_SUPABASE_URL?.trim()
  if (!configured) throw new Error('VITE_SUPABASE_URL is not configured')
  const normalized = configured.replace(/\/$/, '')
  return normalized.endsWith('/rest/v1') ? normalized : `${normalized}/rest/v1`
}

function headers(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

function amount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

export async function getSupplementsAds(date) {
  const params = new URLSearchParams({
    select: 'report_date,meta_cost,google_cost,tiktok_cost,cogs,shipping,fulfillment,processing,fetched_at,updated_at',
    order: 'report_date.asc',
  })
  if (date) {
    if (!validDate(date)) throw new Error('Choose a valid report date')
    params.set('report_date', `eq.${date}`)
    params.set('limit', '1')
  }
  const response = await fetch(`${supabaseRestUrl()}/supplements_ads_reports?${params}`, { headers: headers() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase ADS history failed with ${response.status}`)
  return { rows: (Array.isArray(payload) ? payload : []).map((row) => ({
    report_date: row.report_date,
    meta: amount(row.meta_cost),
    google: amount(row.google_cost),
    tiktok: amount(row.tiktok_cost),
    cogs: amount(row.cogs),
    shipping: amount(row.shipping),
    fulfillment: amount(row.fulfillment),
    processing: amount(row.processing),
    fetched_at: row.fetched_at,
    updated_at: row.updated_at,
  })) }
}

export async function saveSupplementsAds(row) {
  if (!validDate(row?.report_date)) throw new Error('Choose a valid report date')
  const saved = {
    report_date: row.report_date,
    timezone: 'America/New_York',
    currency: 'USD',
    meta_cost: amount(row.meta),
    google_cost: amount(row.google),
    tiktok_cost: amount(row.tiktok),
    cogs: amount(row.cogs),
    shipping: amount(row.shipping),
    fulfillment: amount(row.fulfillment),
    processing: amount(row.processing),
    fetched_at: new Date().toISOString(),
  }
  const response = await fetch(`${supabaseRestUrl()}/supplements_ads_reports?on_conflict=report_date`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(saved),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase ADS save failed with ${response.status}`)
  const result = payload[0] ?? saved
  return { row: {
    report_date: result.report_date,
    meta: amount(result.meta_cost),
    google: amount(result.google_cost),
    tiktok: amount(result.tiktok_cost),
    cogs: amount(result.cogs),
    shipping: amount(result.shipping),
    fulfillment: amount(result.fulfillment),
    processing: amount(result.processing),
  } }
}
