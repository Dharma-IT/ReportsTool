import { createSupplementProduct, deleteSupplementProduct, getSupplementProducts, updateSupplementProduct } from '../_lib/supplement-products.js'

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PUT, DELETE')
    return response.status(405).json({ message: 'Method not allowed' })
  }
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body ?? {}
    const result = request.method === 'GET' ? await getSupplementProducts()
      : request.method === 'POST' ? await createSupplementProduct(body)
        : request.method === 'PUT' ? await updateSupplementProduct(body)
          : await deleteSupplementProduct(body.id)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({ message: error instanceof Error ? error.message : 'Unable to manage supplement products' })
  }
}
