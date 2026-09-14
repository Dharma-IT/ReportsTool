import { fetchShopifySales } from '../_lib/shopify-sales.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body ?? {}
    const result = await fetchShopifySales(body.date)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to fetch Shopify sales',
    })
  }
}
