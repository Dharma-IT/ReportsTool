import { fetchShopifySales } from './shopify-sales.js'
import { shopify2AdminFetch } from './shopify.js'

const EARLIEST_DATE = '2026-09-01'
const SUPLIFUL_PROCESSING_RATE = 0.0299
const SUPLIFUL_FIRST_UNIT_FEE = 1.99
const SUPLIFUL_ADDITIONAL_UNIT_FEE = 1.29

const INTERNATIONAL_ZONES = {
  CA: 1,
  BE: 2, DK: 2, FI: 2, FR: 2, IS: 2, IT: 2, LI: 2, LU: 2, MT: 2, MC: 2, NL: 2, NO: 2, PT: 2, SE: 2, GB: 2,
  AU: 3, BG: 3, HR: 3, CY: 3, CZ: 3, EE: 3, HU: 3, ID: 3, LV: 3, LT: 3, MO: 3, NZ: 3, PH: 3, PL: 3, RO: 3, SK: 3, SI: 3, KR: 3, TH: 3, VN: 3,
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function weightInPounds(value, unit) {
  const weight = Number(value || 0)
  if (weight <= 0) return 0
  switch (String(unit || '').toUpperCase()) {
    case 'GRAMS': return weight / 453.59237
    case 'KILOGRAMS': return weight * 2.2046226218
    case 'OUNCES': return weight / 16
    default: return weight
  }
}

export function suplifulShippingCost(weightLbs, country, province, service) {
  const weight = Number(weightLbs || 0)
  if (weight <= 0) return null
  const countryCode = String(country || '').toUpperCase()
  if (countryCode === 'US') {
    if (['AK', 'HI'].includes(String(province || '').toUpperCase())) return null
    const express = /express|priority/i.test(String(service || ''))
    const brackets = express
      ? [[0.5, 9.99], [0.75, 11.99], [1, 12.49], [2, 17.99], [3, 21.99]]
      : [[0.5, 5.29], [0.75, 6.19], [1, 7.49], [2, 9.99], [3, 12.49]]
    const bracket = brackets.find(([limit]) => weight <= limit)
    return bracket ? bracket[1] : roundMoney(brackets[4][1] + Math.ceil(weight - 3) * (express ? 4.49 : 1.99))
  }
  const zone = INTERNATIONAL_ZONES[countryCode]
  if (!zone) return null
  const rates = { 1: [19, 20, 22, 24, 5.5], 2: [20, 21, 24, 27, 6], 3: [25, 27, 32, 37, 8] }[zone]
  if (weight <= 1) return rates[0]
  if (weight <= 2) return rates[1]
  if (weight <= 3) return rates[2]
  if (weight <= 4) return rates[3]
  return roundMoney(rates[3] + Math.ceil(weight - 4) * rates[4])
}

export function suplifulFulfillmentFee(quantity) {
  const qty = Math.max(0, Number(quantity || 0))
  return qty ? roundMoney(SUPLIFUL_FIRST_UNIT_FEE + Math.max(0, qty - 1) * SUPLIFUL_ADDITIONAL_UNIT_FEE) : 0
}

const PRODUCT_UNIT_COSTS = [
  ['advanced 100 whey protein isolate vanilla', 39.95],
  ['advanced 100 whey protein isolate chocolate', 39.95],
  ['grass fed collagen creamer vanilla', 20.05],
  ['grass fed collagen peptides powder chocolate', 17.45],
  ['grass fed hydrolyzed collagen peptides', 15.29],
  ['hydration powder passion fruit', 11.25],
  ['hydration powder peach mango', 11.29],
  ['hydration powder lemonade', 11.29],
  ['hydration powder lychee', 11.45],
  ['plant protein chocolate', 26.55],
  ['plant protein vanilla', 27.45],
  ['probiotic 40 billion with prebiotics', 8.15],
  ['omega 3 epa 180mg dha 120mg', 8.85],
  ['hair skin and nails essentials', 5.79],
  ['complete multivitamin', 5.69],
  ['apple cider vinegar capsules', 4.55],
  ['digestive enzyme pro blend', 5.29],
  ['vitamin d3 2 000 iu', 7.45],
  ['creatine monohydrate', 10.95],
  ['magnesium glycinate', 6.59],
  ['brain and focus formula', 4.85],
  ['colon gentle cleanse', 15.55],
  ['diet drops ultra 1 oz', 4.85],
  ['bone and heart support', 5.29],
  ['max detox acai detox', 5.75],
  ['fat burner with mct', 7.59],
  ['glp 1 support', 6.65],
  ['sleep formula', 5.25],
  ['energy strips', 8.19],
  ['sleep strips', 7.55],
  ['berberine', 5.55],
  ['maca plus', 5.75],
  ['nad', 9.25],
]

function normalizedProductName(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\bsubscription\b/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

function productUnitCost(name) {
  const normalized = normalizedProductName(name)
  return PRODUCT_UNIT_COSTS.find(([product]) => normalized.includes(product))?.[1] ?? null
}

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
  const orderDetails = new Map()
  let detailOrder = ''
  for (const item of report.rows) {
    if (item.name) detailOrder = item.name
    const detail = orderDetails.get(detailOrder) || { weight: 0, subtotal: 0, fulfillment: 0, fallbackShipping: 0, country: null, province: null, service: null }
    const qty = Number(item.qty || 0)
    detail.weight += weightInPounds(item.unit_weight, item.weight_unit) * qty
    detail.subtotal += (productUnitCost(item.product_name) ?? 0) * qty
    detail.fulfillment += suplifulFulfillmentFee(qty)
    detail.fallbackShipping += Number(item.shipping_charges || 0)
    detail.country ||= item.shipping_country
    detail.province ||= item.shipping_province
    detail.service ||= item.shipping_service
    orderDetails.set(detailOrder, detail)
  }
  let currentOrder = ''
  const assignedFees = new Set()
  const rows = report.rows.map((item) => {
    if (item.name) currentOrder = item.name
    const qty = Number(item.qty || 0)
    const detail = orderDetails.get(currentOrder)
    const calculatedShipping = detail && suplifulShippingCost(detail.weight, detail.country, detail.province, detail.service)
    const shipping = assignedFees.has(currentOrder) ? 0 : (calculatedShipping ?? detail?.fallbackShipping ?? 0)
    const unitPrice = productUnitCost(item.product_name)
    const fulfillment = suplifulFulfillmentFee(qty)
    const processingBase = (detail?.subtotal || 0) + (calculatedShipping ?? detail?.fallbackShipping ?? 0) + (detail?.fulfillment || 0)
    const processing = assignedFees.has(currentOrder) ? 0 : roundMoney(processingBase * SUPLIFUL_PROCESSING_RATE)
    const row = {
      id: item.id,
      date,
      order: currentOrder,
      product: item.product_name,
      qty,
      unit_price: unitPrice,
      subtotal: unitPrice == null ? null : Math.round(unitPrice * qty * 100) / 100,
      shipping,
      fulfillment_supliful: fulfillment,
      processing_supliful: processing,
      processing_shopify: assignedFees.has(currentOrder) ? 0 : Math.round(Number(payouts.get(currentOrder)?.fee || 0) * 100) / 100,
      payout_received: assignedFees.has(currentOrder) ? 0 : Math.round(Number(payouts.get(currentOrder)?.net || 0) * 100) / 100,
      total: 0,
    }
    assignedFees.add(currentOrder)
    row.total = roundMoney((row.subtotal ?? 0) + row.shipping + row.fulfillment_supliful + row.processing_supliful + row.processing_shopify)
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
