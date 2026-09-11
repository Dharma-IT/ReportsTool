import { getSavedShopifyOrderDates, getSavedShopifyOrders, syncShopifyOrders } from '../_lib/shopify-orders.js'

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ message: 'Method not allowed' })
  }

  try {
    if (request.method === 'GET') {
      if (request.query?.dates === '1') {
        const result = await getSavedShopifyOrderDates()
        response.setHeader('Cache-Control', 'no-store')
        return response.status(200).json(result)
      }
      const date = Array.isArray(request.query?.date) ? request.query.date[0] : request.query?.date
      const result = await getSavedShopifyOrders(date)
      response.setHeader('Cache-Control', 'no-store')
      return response.status(200).json(result)
    }
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body ?? {}
    const date = body.date
    const result = await syncShopifyOrders(date, date)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to sync Shopify orders',
    })
  }
}
