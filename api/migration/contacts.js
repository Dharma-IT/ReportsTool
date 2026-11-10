import { getMigrationPage } from '../_lib/migration.js'
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  try {
    return response.status(200).json(await getMigrationPage(process.env.HUBSPOT_ACCESS_TOKEN, String(request.query?.after ?? '')))
  } catch (error) {
    return response.status(502).json({ message: error.message })
  }
}
