import { fetchShopifySales } from './shopify-sales.js'
import { shopify2AdminFetch } from './shopify.js'

const EARLIEST_DATE = '2026-09-01'

function validateDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid report date')
  if (date < EARLIEST_DATE) throw new Error(`Shopify data starts on ${EARLIEST_DATE}`)
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

const PAYOUT_FEES_QUERY = `query PayoutFeesForOrders($after: String, $search: String!) {
  shopifyPaymentsAccount {
    balanceTransactions(first: 250, after: $after, query: $search) {
      nodes { fee { amount } net { amount } associatedOrder { name } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`

async function fetchShopifyProcessingFees(orderNames) {
  const uniqueNames = [...new Set(orderNames.filter(Boolean))]
  if (!uniqueNames.length) return new Map()
  const payouts = new Map()
  for (let start = 0; start < uniqueNames.length; start += 40) {
    const names = uniqueNames.slice(start, start + 40)
    const search = names.map((name) => `order_name:${name}`).join(' OR ')
    let after = null
    do {
      const response = await shopify2AdminFetch('graphql.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: PAYOUT_FEES_QUERY, variables: { after, search } }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.errors) {
        const detail = payload.errors?.map((error) => error.message).join('; ') || payload.error || response.status
        throw new Error(`Shopify payout fees failed: ${detail}`)
      }
      const transactions = payload.data?.shopifyPaymentsAccount?.balanceTransactions
      if (!transactions) throw new Error('The Shopify2 app does not have access to Shopify Payments payouts. Add the read_shopify_payments scope and view_payouts permission.')
      for (const transaction of transactions.nodes) {
        const order = String(transaction.associatedOrder?.name || '').trim()
        if (!order) continue
        const current = payouts.get(order) || { fee: 0, net: 0 }
        current.fee += Math.abs(Number(transaction.fee?.amount || 0))
        current.net += Number(transaction.net?.amount || 0)
        payouts.set(order, current)
      }
      after = transactions.pageInfo.hasNextPage ? transactions.pageInfo.endCursor : null
    } while (after)
  }
  return payouts
}

export async function saveShopifyCogs(date, rows) {
  validateDate(date)
  if (!Array.isArray(rows)) throw new Error('COGS rows must be an array')
  const response = await fetch(`${supabaseRestUrl()}/shopify_cogs_reports?on_conflict=report_date`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ report_date: date, report_data: rows, fetched_at: new Date().toISOString() }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || `Supabase COGS save failed with ${response.status}`)
  }
  return { date, rows }
}

export async function syncShopifyCogs(date) {
  validateDate(date)
  const report = await fetchShopifySales(date)
  const orderNames = report.rows.map((item) => item.name).filter(Boolean)
  const payouts = await fetchShopifyProcessingFees(orderNames)
  let currentOrder = ''
  const assignedFees = new Set()
  const rows = report.rows.map((item) => {
    if (item.name) currentOrder = item.name
    const qty = Number(item.qty || 0)
    const shipping = Number(item.shipping_charges || 0)
    const row = {
      id: item.id,
      date,
      order: currentOrder,
      product: item.product_name,
      qty,
      unit_price: null,
      subtotal: null,
      shipping,
      fulfillment_supliful: 0,
      processing_supliful: 0,
      processing_shopify: assignedFees.has(currentOrder) ? 0 : Math.round(Number(payouts.get(currentOrder)?.fee || 0) * 100) / 100,
      payout_received: assignedFees.has(currentOrder) ? 0 : Math.round(Number(payouts.get(currentOrder)?.net || 0) * 100) / 100,
      total: 0,
    }
    assignedFees.add(currentOrder)
    row.total = Math.round((row.shipping + row.processing_shopify) * 100) / 100
    return row
  })
  await saveShopifyCogs(date, rows)
  return { date, fetchedAt: report.fetchedAt, rows }
}

export async function getSavedShopifyCogs(date) {
  validateDate(date)
  const params = new URLSearchParams({ select: 'report_data,fetched_at', report_date: `eq.${date}`, limit: '1' })
  const response = await fetch(`${supabaseRestUrl()}/shopify_cogs_reports?${params}`, { headers: headers() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase COGS history failed with ${response.status}`)
  return { date, rows: payload[0]?.report_data ?? [], fetchedAt: payload[0]?.fetched_at ?? null }
}

export async function getSavedShopifyCogsDates() {
  const params = new URLSearchParams({ select: 'report_date', order: 'report_date.asc', limit: '10000' })
  const response = await fetch(`${supabaseRestUrl()}/shopify_cogs_reports?${params}`, { headers: headers() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase COGS dates failed with ${response.status}`)
  return { dates: payload.map((row) => row.report_date).filter(Boolean) }
}
