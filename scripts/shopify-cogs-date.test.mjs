import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchShopifySales, getSavedShopifyMonth } from '../api/_lib/shopify-sales.js'
import { fetchShopifyOrderLineItems } from '../api/_lib/shopify-orders.js'
import { syncShopifyCogs } from '../api/_lib/shopify-cogs.js'

const money = (amount) => ({ shopMoney: { amount: String(amount) } })
function order(name, createdAt, status = 'UNFULFILLED', fulfilledAt = null) {
  return {
    name, createdAt, legacyResourceId: name.slice(1), sourceName: 'web',
    displayFulfillmentStatus: status,
    fulfillments: fulfilledAt ? [{ createdAt: fulfilledAt, status: 'SUCCESS' }] : [],
    currentTotalPriceSet: money(25), currentTotalTaxSet: money(0), totalShippingPriceSet: money(5),
    shippingAddress: { countryCodeV2: 'US', provinceCode: 'NY' },
    lineItems: { nodes: [{ id: `${name}-line`, name: 'Berberine', quantity: 1,
      product: { title: 'Berberine' }, originalTotalSet: money(20), discountedTotalSet: money(20), originalUnitPriceSet: money(20),
      variant: { inventoryItem: { measurement: { weight: { value: 0.25, unit: 'POUNDS' } } } },
    }] }, refunds: [],
  }
}

test('COGS uses creation day regardless of fulfillment, across midnight and DST', async (t) => {
  const originalEnv = { ...process.env }
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
    Object.assign(process.env, originalEnv)
  })
  for (const key of ['SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET', 'SHOPIFY2_CLIENT_ID', 'SHOPIFY2_CLIENT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    process.env[key] = 'test'
  }
  process.env.SHOPIFY_STORE_DOMAIN = 'test.myshopify.com'
  process.env.SHOPIFY_API_VERSION = 'test'
  process.env.VITE_SUPABASE_URL = 'https://database.invalid'
  let pages = []
  let saved
  const searches = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const path = String(url)
    if (path.includes('/oauth/')) return Response.json({ access_token: 'test', expires_in: 3600 })
    if (path.includes('supplement_products')) return Response.json([{ id: 'test', name: 'Berberine', match_name: 'berberine', unit_cost: 5.55 }])
    if (path.includes('shopify_cogs_reports')) {
      saved = JSON.parse(options.body)
      return new Response(null, { status: 201 })
    }
    if (path.includes('graphql.json')) {
      const body = JSON.parse(options.body)
      if (body.query.includes('PayoutFeesForOrders')) return Response.json({ data: {
        shopifyPaymentsAccount: { balanceTransactions: {
          nodes: [
            { type: 'CHARGE', associatedOrder: { name: '#2' }, fee: { amount: '1.25' }, net: { amount: '23.75' } },
            { type: 'REFUND', associatedOrder: { name: '#2' }, fee: { amount: '9' }, net: { amount: '-20' } },
            { type: 'ADJUSTMENT', associatedOrder: { name: '#2' }, fee: { amount: '8' }, net: { amount: '-8' } },
          ],
          pageInfo: { hasNextPage: false },
        } },
      } })
      searches.push(body.variables.search)
      const nodes = pages.shift() ?? []
      return Response.json({ data: { orders: { nodes, pageInfo: { hasNextPage: pages.length > 0, endCursor: 'next' } } } })
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  pages = [[
    order('#1', '2026-10-27T03:59:59Z', 'FULFILLED', '2026-10-28T15:00:00Z'),
    order('#2', '2026-10-27T04:00:00Z'),
  ], [
    order('#3', '2026-10-28T03:59:59Z', 'FULFILLED', '2026-10-29T15:00:00Z'),
    order('#4', '2026-10-28T04:00:00Z'),
  ]]
  const report = await fetchShopifySales('2026-10-27')
  assert.deepEqual(report.rows.map((row) => row.order_name), ['#2', '#3'])
  assert(report.rows.every((row) => row.day === '2026-10-27' && row.cost_recognition_date === '2026-10-27'))
  assert(searches.every((search) => search === 'created_at:>=2026-10-26 created_at:<2026-10-29'))

  const boundaryOrders = [order('#1', '2026-10-27T03:59:59Z'), order('#2', '2026-10-27T04:00:00Z'),
    { ...order('#3', '2026-10-28T03:59:59Z'), email: 'buyer@scs.tiktokw.us' }, order('#4', '2026-10-28T04:00:00Z')]
  pages = [boundaryOrders]
  const sales = await fetchShopifySales('2026-10-27')
  assert.deepEqual(sales.rows.map((row) => row.order_name), ['#2', '#3'])
  assert.equal(sales.rows[1].sales_channel, 'tiktok')
  assert(sales.rows.every((row) => row.day === '2026-10-27'))
  pages = [boundaryOrders]
  const orders = await fetchShopifyOrderLineItems('2026-10-27', '2026-10-27')
  assert.deepEqual(orders.map((row) => row.name), ['#2', '#3'])
  assert(orders.every((row) => row.order_date === '2026-10-27'))

  for (const [date, start, end] of [
    ['2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['2027-03-14', '2027-03-14T05:00:00Z', '2027-03-15T04:00:00Z'],
  ]) {
    pages = [[order('#1', new Date(Date.parse(start) - 1).toISOString()), order('#2', start),
      order('#3', new Date(Date.parse(end) - 1).toISOString()), order('#4', end)]]
    const result = await fetchShopifySales(date)
    assert.deepEqual(result.rows.map((row) => row.order_name), ['#2', '#3'])
  }

  // Exercise the complete cost-and-fee calculation and save for an unfulfilled order.
  pages = [[order('#2', '2026-10-27T04:00:00Z'),
    order('#1', '2026-10-26T12:00:00Z', 'FULFILLED', '2026-10-27T12:00:00Z')]]
  const costs = await syncShopifyCogs('2026-10-27')
  assert.equal(costs.rows.length, 1)
  assert.equal(costs.rows[0].order, '#2')
  assert.equal(costs.rows[0].subtotal, 5.04)
  assert.equal(costs.rows[0].shipping, 6.02)
  assert.equal(costs.rows[0].fulfillment_supliful, 0)
  assert.equal(costs.rows[0].processing_supliful, 0)
  assert.equal(costs.rows[0].processing_shopify, 1.25)
  assert.equal(costs.rows[0].total, 12.31)
  assert.equal(saved.report_date, '2026-10-27')
  assert.deepEqual(saved.report_data, costs.rows)

  const makeProductOrder = (name, product, channel = 'web', price = 25) => {
    const result = order(name, '2026-10-27T12:00:00Z')
    result.sourceName = channel
    result.currentTotalPriceSet = money(price)
    result.lineItems.nodes[0].name = product
    result.lineItems.nodes[0].product.title = product
    return result
  }
  const multi = makeProductOrder('#multi', 'Berberine', 'tiktok')
  multi.lineItems.nodes.push({ ...multi.lineItems.nodes[0], id: 'extra', name: 'Slim Boost', quantity: 2 })
  pages = [[
    makeProductOrder('#2', 'Detox tea'),
    makeProductOrder('#paid', 'Slim Boost', 'TikTok'),
    makeProductOrder('#free', 'Berberine', 'tiktok', 0),
    makeProductOrder('#freeweb', 'Berberine', 'web', 0),
    makeProductOrder('#missing', 'Detox tea'),
    multi,
  ]]
  const rules = (await syncShopifyCogs('2026-10-27')).rows
  const byOrder = (name) => rules.filter((row) => row.order === name)
  assert.equal(byOrder('#2')[0].unit_price, 1.98)
  assert.equal(byOrder('#2')[0].processing_shopify, 1.25)
  assert.equal(byOrder('#paid')[0].unit_price, 16)
  assert.equal(byOrder('#paid')[0].shipping, 6.02)
  assert.equal(byOrder('#paid')[0].processing_shopify, 10)
  assert.equal(byOrder('#free')[0].processing_shopify, 0)
  assert.equal(byOrder('#freeweb')[0].processing_shopify, 0)
  assert.equal(byOrder('#missing')[0].processing_shopify, 0)
  assert.equal(byOrder('#multi').reduce((sum, row) => sum + row.shipping, 0), 6.02)
  assert.equal(byOrder('#multi').reduce((sum, row) => sum + row.processing_shopify, 0), 10)
  assert.equal(byOrder('#multi')[1].subtotal, 32)
  assert(rules.every((row) => row.fulfillment_supliful === 0 && row.processing_supliful === 0))

})

test('month-to-date includes selected day, excludes later dates, and counts costs once', async (t) => {
  process.env.VITE_SUPABASE_URL = 'https://database.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
  const snapshots = {
    shopify_sales_reports: [
      { report_date: '2026-09-30', report_data: { rows: [{ qty: 99, total_sales: 999 }] } },
      { report_date: '2026-10-01', report_data: { rows: [{ qty: 2, total_sales: 100, sales_channel: 'web' }, { qty: 1, total_sales: null, sales_channel: 'web' }] } },
      { report_date: '2026-10-02', report_data: { rows: [{ qty: 4, total_sales: 200, sales_channel: 'tiktok' }] } },
      { report_date: '2026-10-03', report_data: { rows: [{ qty: 99, total_sales: 999 }] } },
    ],
    shopify_cogs_reports: [{ report_date: '2026-10-01', report_data: [
      { subtotal: 10, shipping: 5, fulfillment_supliful: 2, processing_supliful: 1, processing_shopify: 3 },
    ] }],
    supplements_ads_reports: [
      { report_date: '2026-10-01', meta_cost: 4, google_cost: 5, tiktok_cost: 6, cogs: 999, processing: 999 },
      { report_date: '2026-10-02', meta_cost: 1, google_cost: 2, tiktok_cost: 3, cogs: 20, shipping: 10, fulfillment: 4, processing: 2 },
    ],
  }
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input)
    assert.deepEqual(url.searchParams.getAll('report_date'), ['gte.2026-10-01', 'lte.2026-10-02'])
    const table = url.pathname.split('/').at(-1)
    return Response.json(snapshots[table].filter((row) => row.report_date >= '2026-10-01' && row.report_date <= '2026-10-02'))
  })
  const { monthly: m, missingDates } = await getSavedShopifyMonth('2026-10-02')
  assert.deepEqual(missingDates, [])
  assert.equal(m.sales, 300)
  assert.equal(m.qty, 7)
  assert.equal(m.shopifySales, 100)
  assert.equal(m.tiktokSales, 200)
  const spend = m.meta + m.google + m.tiktok + m.cogs + m.shipping + m.fulfillment + m.processingSupliful + m.processingShopify
  assert.equal(spend, 78)
  assert.equal(m.sales - spend, 222)
  snapshots.supplements_ads_reports.pop()
  assert.deepEqual((await getSavedShopifyMonth('2026-10-02')).missingDates, ['2026-10-02'])
})
