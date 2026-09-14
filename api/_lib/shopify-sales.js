import { shopifyAdminFetch } from './shopify.js'

const EARLIEST_DATE = '2026-09-01'

const SALES_QUERY = `query SalesForSupplements($after: String, $search: String!) {
  orders(first: 100, after: $after, sortKey: CREATED_AT, query: $search) {
    nodes {
      name
      currentTotalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      lineItems(first: 100) {
        nodes {
          id
          name
          quantity
          originalTotalSet { shopMoney { amount } }
          discountedTotalSet { shopMoney { amount } }
        }
      }
      refunds {
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

      order.lineItems.nodes.forEach((item, index) => {
        rows.push({
          id: `${order.name}-${item.id}`,
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
