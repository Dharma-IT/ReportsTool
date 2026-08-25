const BOOKINGS_API_URL = 'https://dharma-agent-yd5l.onrender.com/api/reports/bookings'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const upstream = await fetch(BOOKINGS_API_URL, {
      headers: { Accept: 'application/json' },
    })
    const body = await upstream.text()

    response.status(upstream.status)
    response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response.send(body)
  } catch (error) {
    return response.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to load booking report',
    })
  }
}
