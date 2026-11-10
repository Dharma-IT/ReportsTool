export function migrationContact(p) {
  const name = [p.firstname, p.lastname].map(v => String(v ?? '').trim()).filter(Boolean).join(' ')
  if (!name) return { reason: 'noName' }
  const phone = [p.phone, p.mobilephone].map(v => String(v ?? '').replace(/\D/g, '')).find(Boolean)
  if (!phone) return { reason: 'noPhone' }
  return { contact: { name, phone, email: `${phone}@dummy.com` } }
}
export async function getMigrationPage(token, after = '') {
  if (!token) throw new Error('Missing HUBSPOT_ACCESS_TOKEN on the server.')
  if (after && !/^\d{1,30}$/.test(after)) throw new Error('Invalid contact cursor.')
  const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts')
  url.searchParams.set('limit', '100')
  url.searchParams.set('properties', 'firstname,lastname,phone,mobilephone')
  url.searchParams.set('archived', 'false')
  if (after) url.searchParams.set('after', after)
  let upstream
  for (let attempt = 0; attempt < 4; attempt++) {
    upstream = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
    if (upstream.status !== 429 && upstream.status < 500) break
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, Math.min(5000, Math.max(1000, Number(upstream.headers.get('retry-after') || 1) * 1000))))
  }
  if (!upstream.ok) throw new Error(`HubSpot contacts request failed (${upstream.status}). Please retry.`)
  const payload = await upstream.json()
  const contacts = []
  let noName = 0, noPhone = 0
  for (const row of payload.results) {
    const result = migrationContact(row.properties)
    if (result.contact) contacts.push(result.contact)
    else if (result.reason === 'noName') noName++
    else noPhone++
  }
  return { contacts, noName, noPhone, scanned: payload.results.length, after: payload.paging?.next?.after ? String(payload.paging.next.after) : null }
}
