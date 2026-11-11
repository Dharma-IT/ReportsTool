import { getMigrationDealMetadata, getMigrationDealPage } from '../_lib/migration-deals.js'
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  try {
    const token = process.env.HUBSPOT_ACCESS_TOKEN
    const result = request.query?.metadata === '1' ? { pipelines: (await getMigrationDealMetadata(token)).pipelines } : await getMigrationDealPage(token, String(request.query?.pipeline ?? ''), String(request.query?.after ?? ''))
    return response.status(200).json(result)
  } catch (error) { return response.status(502).json({ message: error.message }) }
}
