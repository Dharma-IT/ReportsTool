import { getBiginTransactions } from './_lib/bigin-transactions.js'
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  try {
    return response.status(200).json(await getBiginTransactions(new URL(request.url, 'http://localhost').searchParams))
  } catch (error) { return response.status(error.status || 502).json({ message: error.message }) }
}
