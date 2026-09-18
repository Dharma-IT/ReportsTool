import { shopifyAdminFetch } from './shopify.js'

const EARLIEST_DATE = '2026-09-01'

const SALES_QUERY = `query SalesForSupplements($after: String, $search: String!) {
  orders(first: 100, after: $after, sortKey: CREATED_AT, query: $search) {
    nodes {
      legacyResourceId
      name
      createdAt
      currentTotalPriceSet { shopMoney { amount } }
      currentTotalTaxSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      lineItems(first: 100) {
        nodes {
          id
          name
          product { title }
          quantity
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
      search: `created_at:>=${date} created_at:<${nextDate(date)}`,
    })
    const orders = data.orders

    for (const order of orders.nodes) {
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
          day: order.createdAt.slice(0, 10),
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
