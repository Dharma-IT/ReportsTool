import { getSupplementsAds, saveSupplementsAds } from '../_lib/supplements-ads.js'

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ message: 'Method not allowed' })
  }
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body ?? {}
    const result = request.method === 'GET'
      ? await getSupplementsAds(String(request.query?.date ?? ''))
      : await saveSupplementsAds(body)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({ message: error instanceof Error ? error.message : 'Unable to process ADS data' })
  }
}
