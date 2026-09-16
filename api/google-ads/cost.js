import { fetchGoogleAdsCost } from '../_lib/google-ads.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'Method not allowed' })
  }
  try {
    const date = String(request.query?.date ?? '')
    const result = await fetchGoogleAdsCost(date)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({ message: error instanceof Error ? error.message : 'Unable to fetch Google Ads cost.' })
  }
}
