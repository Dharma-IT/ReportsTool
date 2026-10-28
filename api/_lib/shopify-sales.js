import { shopifyAdminFetch } from './shopify.js'

const EARLIEST_DATE = '2026-09-01'

const SALES_QUERY = `query SalesForSupplements($after: String, $search: String!) {
  orders(first: 250, after: $after, sortKey: CREATED_AT, query: $search) {
    nodes {
      legacyResourceId
      name
      createdAt
      email
      sourceName
      displayFulfillmentStatus
      currentTotalPriceSet { shopMoney { amount } }
      currentTotalTaxSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      shippingAddress { countryCodeV2 provinceCode }
      shippingLine { code title }
      lineItems(first: 100) {
        nodes {
          id
          name
          product { title }
          quantity
          variant { inventoryItem { measurement { weight { value unit } } } }
          originalTotalSet { shopMoney { amount } }
          discountedTotalSet { shopMoney { amount } }
        }
      }
      refunds {
        totalRefundedSet { shopMoney { amount } }
        refundLineItems(first: 100) {
          nodes {
            quantity
            lineItem { id }
            subtotalSet { shopMoney { amount } }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function nextDate(value) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function previousDate(value, days) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function easternDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value))
}

function validateDate(date) {
  if (!validDate(date)) throw new Error('Choose a valid report date')
  if (date < EARLIEST_DATE) throw new Error(`Shopify data starts on ${EARLIEST_DATE}`)
}

function amount(moneySet) {
  return Number(moneySet?.shopMoney?.amount ?? 0)
}

async function shopifyGraphql(query, variables) {
  const response = await shopifyAdminFetch('graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.errors) {
    const detail = payload.errors?.map((error) => error.message).join('; ')
      || payload.error || `request failed with ${response.status}`
    throw new Error(`Shopify sales failed: ${detail}`)
  }
  return payload.data
}

export async function fetchShopifySales(date) {
  validateDate(date)
  const rows = []
  let after = null

  do {
    const data = await shopifyGraphql(SALES_QUERY, {
      after,
      // Costs and fees belong to the order's creation day in New York.
      // Pad the search window, then filter locally so UTC midnight and DST
      // boundaries cannot move an order into the wrong report day.
      search: `created_at:>=${previousDate(date, 1)} created_at:<${nextDate(nextDate(date))}`,
    })
    const orders = data.orders

    for (const order of orders.nodes) {
      const costRecognitionDate = easternDate(order.createdAt)
      if (costRecognitionDate !== date) continue
      const refundByLineItem = new Map()
      for (const refund of order.refunds ?? []) {
        for (const refundedItem of refund.refundLineItems?.nodes ?? []) {
          const id = refundedItem.lineItem?.id
          if (id) refundByLineItem.set(id, (refundByLineItem.get(id) ?? 0) + amount(refundedItem.subtotalSet))
        }
      }

      const grossSales = order.lineItems.nodes.reduce((sum, item) => sum + amount(item.originalTotalSet), 0)
      const discountedSales = order.lineItems.nodes.reduce((sum, item) => sum + amount(item.discountedTotalSet), 0)
      const returns = [...refundByLineItem.values()].reduce((sum, value) => sum + value, 0)
      const totalRefunded = (order.refunds ?? []).reduce((sum, refund) => sum + amount(refund.totalRefundedSet), 0)
      const returnFees = Math.max(0, totalRefunded - returns)

      order.lineItems.nodes.forEach((item, index) => {
        const lineGross = amount(item.originalTotalSet)
        const lineDiscounted = amount(item.discountedTotalSet)
        const lineReturns = refundByLineItem.get(item.id) ?? 0
        const shipping = index === 0 ? amount(order.totalShippingPriceSet) : 0
        const taxes = index === 0 ? amount(order.currentTotalTaxSet) : 0
        const lineReturnFees = index === 0 ? returnFees : 0
        rows.push({
          id: `${order.name}-${item.id}`,
          day: costRecognitionDate,
          sale_id: String(order.legacyResourceId),
          order_name: order.name,
          product_title: item.product?.title || item.name,
          line_gross_sales: lineGross,
          line_discounts: -(lineGross - lineDiscounted),
          line_returns: -lineReturns,
          line_net_sales: lineDiscounted - lineReturns,
          line_shipping_charges: shipping,
          line_return_fees: -lineReturnFees,
          line_taxes: taxes,
          line_total_sales: lineDiscounted - lineReturns + shipping - lineReturnFees + taxes,
          name: index === 0 ? order.name : '',
          gross_sales: index === 0 ? grossSales : null,
          discounts: index === 0 ? -(grossSales - discountedSales) : null,
          returns: index === 0 ? -returns : null,
          net_sales: index === 0 ? discountedSales - returns : null,
          shipping_charges: index === 0 ? amount(order.totalShippingPriceSet) : null,
          total_sales: index === 0 ? amount(order.currentTotalPriceSet) : null,
          qty: item.quantity,
          sales: amount(item.discountedTotalSet) - (refundByLineItem.get(item.id) ?? 0),
          product_name: item.name,
          unit_weight: Number(item.variant?.inventoryItem?.measurement?.weight?.value ?? 0),
          weight_unit: item.variant?.inventoryItem?.measurement?.weight?.unit ?? null,
          shipping_country: order.shippingAddress?.countryCodeV2 ?? null,
          shipping_province: order.shippingAddress?.provinceCode ?? null,
          shipping_service: order.shippingLine?.code || order.shippingLine?.title || null,
          sales_channel: /tiktok/i.test(order.sourceName ?? '') || /@scs\.tiktokw\.us$/i.test(order.email ?? '')
            ? 'tiktok' : order.sourceName || null,
          fulfillment_status: order.displayFulfillmentStatus || null,
          cost_recognition_date: costRecognitionDate,
        })
      })
    }
    after = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null
  } while (after)

  return { date, fetchedAt: new Date().toISOString(), rows }
}

export async function fetchHistoricalShopifyProductSales(toDate) {
  validateDate(toDate)
  const products = new Map()
  let after = null

  do {
    const data = await shopifyGraphql(SALES_QUERY, {
      after,
      search: `created_at:<${nextDate(toDate)}`,
    })
    const orders = data.orders
    for (const order of orders.nodes) {
      const refunds = new Map()
      for (const refund of order.refunds ?? []) {
        for (const refundedItem of refund.refundLineItems?.nodes ?? []) {
          const id = refundedItem.lineItem?.id
          if (!id) continue
          const current = refunds.get(id) ?? { quantity: 0, amount: 0 }
          current.quantity += Number(refundedItem.quantity ?? 0)
          current.amount += amount(refundedItem.subtotalSet)
          refunds.set(id, current)
        }
      }
      for (const item of order.lineItems.nodes) {
        const productName = String(item.product?.title || item.name).trim()
        const key = productName.toLowerCase()
        const current = products.get(key) ?? { product: productName, qty: 0, sales_amount: 0 }
        const returned = refunds.get(item.id) ?? { quantity: 0, amount: 0 }
        current.qty += Math.max(0, Number(item.quantity) - returned.quantity)
        current.sales_amount += amount(item.discountedTotalSet) - returned.amount
        products.set(key, current)
      }
    }
    after = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null
  } while (after)

  return [...products.values()]
    .map((row) => ({ ...row, sales_amount: Math.round(row.sales_amount * 100) / 100 }))
    .filter((row) => row.qty > 0 || Math.abs(row.sales_amount) >= 0.01)
    .sort((left, right) => left.product.localeCompare(right.product))
}

function supabaseRestUrl() {
  const configured = process.env.VITE_SUPABASE_URL?.trim()
  if (!configured) throw new Error('VITE_SUPABASE_URL is not configured')
  const normalized = configured.replace(/\/$/, '')
  return normalized.endsWith('/rest/v1') ? normalized : `${normalized}/rest/v1`
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

export async function syncShopifySales(date) {
  const report = await fetchShopifySales(date)
  const response = await fetch(`${supabaseRestUrl()}/shopify_sales_reports?on_conflict=report_date`, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ report_date: date, report_data: report, fetched_at: report.fetchedAt }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || `Supabase save failed with ${response.status}`)
  }
  return report
}

export async function updateHistoricalShopifySales(toDate) {
  validateDate(toDate)
  const historicalRows = await fetchHistoricalShopifyProductSales(toDate)
  const report = { throughDate: toDate, fetchedAt: new Date().toISOString(), historicalRows }
  const response = await fetch(`${supabaseRestUrl()}/shopify_sales_history?on_conflict=report_key`, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ report_key: 'all-time', report_data: report, fetched_at: report.fetchedAt }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || `Supabase historical save failed with ${response.status}`)
  }
  return report
}

export async function getHistoricalShopifySales() {
  const params = new URLSearchParams({ select: 'report_data', report_key: 'eq.all-time', limit: '1' })
  const response = await fetch(`${supabaseRestUrl()}/shopify_sales_history?${params}`, { headers: supabaseHeaders() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase historical report failed with ${response.status}`)
  return payload[0]?.report_data ?? { historicalRows: [] }
}

export async function getSavedShopifySales(date) {
  validateDate(date)
  const params = new URLSearchParams({ select: 'report_data', report_date: `eq.${date}`, limit: '1' })
  const response = await fetch(`${supabaseRestUrl()}/shopify_sales_reports?${params}`, { headers: supabaseHeaders() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase history failed with ${response.status}`)
  return payload[0]?.report_data ?? { date, rows: [] }
}

export async function getSavedShopifySalesDates() {
  const params = new URLSearchParams({ select: 'report_date', order: 'report_date.asc', limit: '10000' })
  const response = await fetch(`${supabaseRestUrl()}/shopify_sales_reports?${params}`, { headers: supabaseHeaders() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase history failed with ${response.status}`)
  return { dates: payload.map((row) => row.report_date).filter(Boolean) }
}

export async function getSavedShopifyMonth(date) {
  validateDate(date)
  const start = `${date.slice(0, 7)}-01`
  const load = async (table) => {
    const params = new URLSearchParams({ select: '*', order: 'report_date.asc', limit: '1000' })
    params.append('report_date', `gte.${start}`)
    params.append('report_date', `lte.${date}`)
    const response = await fetch(`${supabaseRestUrl()}/${table}?${params}`, { headers: supabaseHeaders() })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.message || `Monthly report failed with ${response.status}`)
    return payload
  }
  const [sales, cogs, ads] = await Promise.all([
    load('shopify_sales_reports'), load('shopify_cogs_reports'), load('supplements_ads_reports'),
  ])
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
  const monthly = { qty: 0, sales: 0, shopifyQty: 0, shopifySales: 0, tiktokQty: 0, tiktokSales: 0,
    meta: 0, google: 0, tiktok: 0, cogs: 0, shipping: 0, fulfillment: 0, processingSupliful: 0, processingShopify: 0 }
  const costs = new Map(cogs.map((row) => [row.report_date, row.report_data]))
  const salesDates = new Set(sales.map((row) => row.report_date))
  const adsDates = new Set(ads.map((row) => row.report_date))
  for (const snapshot of sales) for (const row of snapshot.report_data?.rows ?? []) {
    monthly.qty += number(row.qty)
    monthly.sales += number(row.total_sales)
    const channel = /tiktok/i.test(row.sales_channel ?? '') ? 'tiktok' : 'shopify'
    monthly[`${channel}Qty`] += number(row.qty)
    monthly[`${channel}Sales`] += number(row.total_sales)
  }
  const adsByDate = new Map(ads.map((row) => [row.report_date, row]))
  const missingDates = []
  for (let day = start; day <= date; day = nextDate(day)) {
    if (!salesDates.has(day) || !adsDates.has(day)) missingDates.push(day)
    const ad = adsByDate.get(day) ?? {}
    monthly.meta += number(ad.meta_cost)
    monthly.google += number(ad.google_cost)
    monthly.tiktok += number(ad.tiktok_cost)
    if (costs.has(day)) {
      for (const row of costs.get(day) ?? []) {
        monthly.cogs += number(row.subtotal)
        monthly.shipping += number(row.shipping)
        monthly.fulfillment += number(row.fulfillment_supliful)
        monthly.processingSupliful += number(row.processing_supliful)
        monthly.processingShopify += number(row.processing_shopify)
      }
    } else {
      monthly.cogs += number(ad.cogs)
      monthly.shipping += number(ad.shipping)
      monthly.fulfillment += number(ad.fulfillment)
      monthly.processingSupliful += number(ad.processing)
    }
  }
  return { monthly, missingDates }
}
