import { fetchMetaAdsCost } from '../_lib/meta-ads.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'Method not allowed' })
  }
  try {
    const result = await fetchMetaAdsCost(String(request.query?.date ?? ''))
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({ message: error instanceof Error ? error.message : 'Unable to fetch Meta Ads cost.' })
  }
}
