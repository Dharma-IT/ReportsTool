import { todoRequest } from './_lib/todo.js'
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  if (request.method === 'OPTIONS') return response.status(204).end()
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    return response.status(200).json(await todoRequest(request.method, body))
  } catch (error) { return response.status(error.status ?? 502).json({ message: error.message }) }
}
