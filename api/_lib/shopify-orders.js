import { shopifyAdminFetch } from './shopify.js'

const EARLIEST_DATE = '2026-09-01'

const ORDERS_QUERY = `query OrdersForSupplements($after: String, $search: String!) {
  orders(first: 100, after: $after, sortKey: CREATED_AT, query: $search) {
    nodes {
      legacyResourceId
      name
      email
      displayFinancialStatus
      transactions { kind status processedAt }
      lineItems(first: 100) {
        nodes {
          id
          name
          quantity
          sku
          originalUnitPriceSet { shopMoney { amount } }
          variant { compareAtPrice }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`

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
    throw new Error(`Shopify orders failed: ${detail}`)
  }
  return payload.data
}

function paidAt(order) {
  const successfulPayments = (order.transactions ?? []).filter((transaction) =>
    transaction.status === 'SUCCESS' && ['SALE', 'CAPTURE'].includes(transaction.kind),
  )
  return successfulPayments.at(-1)?.processedAt ?? null
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function nextDate(value) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function validateRange(from, to) {
  if (!validDate(from) || !validDate(to)) throw new Error('Choose a valid date range')
  if (from < EARLIEST_DATE) throw new Error(`Shopify data starts on ${EARLIEST_DATE}`)
  if (from > to) throw new Error('The start date must be on or before the end date')
}

export async function fetchShopifyOrderLineItems(from, to) {
  validateRange(from, to)
  const rows = []
  let after = null

  do {
    const data = await shopifyGraphql(ORDERS_QUERY, {
      after,
      search: `created_at:>=${from} created_at:<${nextDate(to)}`,
    })
    const orders = data.orders
    for (const order of orders.nodes) {
      for (const lineitem of order.lineItems.nodes) {
        rows.push({
          shopify_order_id: order.legacyResourceId,
          shopify_lineitem_id: lineitem.id.split('/').at(-1),
          order_date: from,
          name: order.name,
          email: order.email || null,
          financial_status: order.displayFinancialStatus,
          paid_at: paidAt(order),
          lineitem_quantity: lineitem.quantity,
          lineitem_name: lineitem.name,
          lineitem_price: Number(lineitem.originalUnitPriceSet.shopMoney.amount),
          lineitem_compare_at_price: lineitem.variant?.compareAtPrice == null
            ? null
            : Number(lineitem.variant.compareAtPrice),
          lineitem_sku: lineitem.sku || null,
          fetched_at: new Date().toISOString(),
        })
      }
    }
    after = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null
  } while (after)

  return rows
}

function supabaseRestUrl() {
  const configured = process.env.VITE_SUPABASE_URL?.trim()
  if (!configured) throw new Error('VITE_SUPABASE_URL is not configured')
  const normalized = configured.replace(/\/$/, '')
  return normalized.endsWith('/rest/v1') ? normalized : `${normalized}/rest/v1`
}

export async function saveShopifyOrderLineItems(rows, orderDate) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')

  const deleteResponse = await fetch(
    `${supabaseRestUrl()}/shopify_order_line_items?order_date=eq.${encodeURIComponent(orderDate)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
    },
  )
  if (!deleteResponse.ok) {
    const payload = await deleteResponse.json().catch(() => ({}))
    throw new Error(payload.message || `Supabase replacement failed with ${deleteResponse.status}`)
  }

  if (!rows.length) return

  for (let index = 0; index < rows.length; index += 500) {
    const response = await fetch(
      `${supabaseRestUrl()}/shopify_order_line_items?on_conflict=shopify_order_id,shopify_lineitem_id`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows.slice(index, index + 500)),
      },
    )
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || `Supabase save failed with ${response.status}`)
    }
  }
}

export async function syncShopifyOrders(from, to) {
  validateRange(from, to)
  const rows = await fetchShopifyOrderLineItems(from, to)
  await saveShopifyOrderLineItems(rows, from)
  return { from, to, fetchedAt: new Date().toISOString(), rows }
}

export async function getSavedShopifyOrders(date) {
  validateRange(date, date)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  const params = new URLSearchParams({
    select: '*',
    order_date: `eq.${date}`,
    order: 'paid_at.asc.nullslast,name.asc',
  })
  const response = await fetch(`${supabaseRestUrl()}/shopify_order_line_items?${params}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Supabase history failed with ${response.status}`)
  return { date, rows: payload }
}
