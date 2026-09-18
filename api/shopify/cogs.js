import { getSavedShopifyCogs, getSavedShopifyCogsDates, saveShopifyCogs, syncShopifyCogs } from '../_lib/shopify-cogs.js'

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PUT'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PUT')
    return response.status(405).json({ message: 'Method not allowed' })
  }
  try {
    if (request.method === 'GET') {
      const result = request.query?.dates === '1'
        ? await getSavedShopifyCogsDates()
        : await getSavedShopifyCogs(Array.isArray(request.query?.date) ? request.query.date[0] : request.query?.date)
      response.setHeader('Cache-Control', 'no-store')
      return response.status(200).json(result)
    }
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body ?? {}
    const result = request.method === 'PUT'
      ? await saveShopifyCogs(body.date, body.rows)
      : await syncShopifyCogs(body.date)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({ message: error instanceof Error ? error.message : 'Unable to process Shopify COGS' })
  }
}
