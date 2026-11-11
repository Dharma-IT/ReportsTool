export async function fetchMigrationDeals(apiBase, query) {
  // The deployed site also has a server-side endpoint; use it if Render is unreachable.
  const bases = apiBase ? [apiBase, '', apiBase] : ['', '', '']
  let lastError
  for (let attempt = 0; attempt < bases.length; attempt++) {
    try {
      const response = await fetch(`${bases[attempt]}/api/migration/deals?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Pipeline API returned an unexpected response. The server may be restarting.')
      const result = await response.json()
      if (response.ok) return result
      const message = result.message ?? `Unable to load HubSpot deals (${response.status})`
      if (response.status < 500 && response.status !== 429) throw Object.assign(new Error(message), { permanent: true })
      lastError = new Error(message)
    } catch (error) {
      if (error?.permanent) throw error
      lastError = error
    }
    if (attempt < bases.length - 1) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
  }
  if (lastError?.name === 'TypeError' || lastError?.name === 'TimeoutError' || lastError?.name === 'AbortError') {
    throw new Error('Could not reach the pipeline API after automatic retries. The backend may be waking up or restarting. Wait a moment, then retry; saved exports and progress are preserved.')
  }
  throw lastError ?? new Error('Unable to load HubSpot deals. Retry to resume.')
}
