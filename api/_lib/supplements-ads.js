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
    select: 'report_date,meta,google,tiktok,fetched_at,updated_at',
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
  return { rows: Array.isArray(payload) ? payload : [] }
}

export async function saveSupplementsAds(row) {
  if (!validDate(row?.report_date)) throw new Error('Choose a valid report date')
  const saved = {
    report_date: row.report_date,
    meta: amount(row.meta),
    google: amount(row.google),
    tiktok: amount(row.tiktok),
    fetched_at: new Date().toISOString(),
  }
  const response = await fetch(`${supabaseRestUrl()}/supplements_ads_reports?on_conflict=report_date`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(saved),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase ADS save failed with ${response.status}`)
  return { row: payload[0] ?? saved }
}
