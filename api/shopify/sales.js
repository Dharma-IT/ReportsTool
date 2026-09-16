import { getHistoricalShopifySales, getSavedShopifySales, getSavedShopifySalesDates, syncShopifySales, updateHistoricalShopifySales } from '../_lib/shopify-sales.js'

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body ?? {}
    const result = request.method === 'GET'
      ? request.query?.history === '1'
        ? await getHistoricalShopifySales()
        : request.query?.dates === '1'
        ? await getSavedShopifySalesDates()
        : await getSavedShopifySales(String(request.query?.date ?? ''))
      : body.mode === 'history'
        ? await updateHistoricalShopifySales(body.date)
        : await syncShopifySales(body.date)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to fetch Shopify sales',
    })
  }
}
