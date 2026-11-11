const properties = ['dealname', 'meeting_type', 'evaluation_date_and_hour_2', 'phone', 'agent_lead_management', 'classification', 'dealstage', 'closedate', 'hubspot_owner_id', 'amount', 'paid_date_all_pipelines', 'pipeline']
let cached
async function request(token, path, body) {
  if (!token) throw new Error('Missing HUBSPOT_ACCESS_TOKEN on the server.')
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://api.hubapi.com${path}`, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000) })
    if (response.ok) return response.json()
    if (attempt === 3 || (response.status !== 429 && response.status < 500)) throw new Error(`HubSpot request failed (${response.status}). Retry to resume.`)
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
  }
}
export async function getMigrationDealMetadata(token) {
  if (cached?.token === token && cached.expires > Date.now()) return cached.value
  const [pipelines, fields] = await Promise.all([request(token, '/crm/v3/pipelines/deals'), request(token, '/crm/v3/properties/deals')])
  if (!fields.results.some(field => field.name === 'paid_date_all_pipelines')) throw new Error('HubSpot Paid date (all pipelines) field is unavailable. Export stopped.')
  const owners = []
  for (const archived of ['false', 'true']) {
    let after = ''
    do {
      const page = await request(token, `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${encodeURIComponent(after)}` : ''}`)
      owners.push(...page.results)
      after = page.paging?.next?.after
    } while (after)
  }
  const value = { pipelines: pipelines.results.map(p => ({ id: p.id, label: p.label, stages: p.stages.map(s => ({ id: s.id, label: s.label.trim() })) })), options: Object.fromEntries(fields.results.map(p => [p.name, Object.fromEntries((p.options ?? []).map(o => [o.value, o.label]))])), owners: Object.fromEntries(owners.map(o => [o.id, `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() || o.email || o.id])) }
  cached = { token, value, expires: Date.now() + 300000 }
  return value
}
export function migrationDeal(p, metadata) {
  const label = (field) => metadata.options[field]?.[p[field]] ?? p[field] ?? ''
  const phone = String(p.phone ?? '').replace(/\D/g, '')
  const stage = metadata.pipelines.flatMap(pipeline => pipeline.stages).find(s => s.id === p.dealstage)?.label ?? p.dealstage ?? ''
  const name = String(p.dealname ?? '').replace(/^\s*(?:new\s+sale|cs|sellers)\s*[-\u2013\u2014:]\s*/i, '').replace(/[\d\-\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim()
  return [name, label('meeting_type'), p.evaluation_date_and_hour_2 ?? '', phone, label('agent_lead_management'), label('classification'), stage, (p.closedate ?? '').slice(0, 10), metadata.owners[p.hubspot_owner_id] ?? p.hubspot_owner_id ?? '', p.amount ?? '', phone ? `${phone}@dummy.com` : '', (p.paid_date_all_pipelines ?? '').slice(0, 10)]
}
export async function getMigrationDealPage(token, pipeline, after = '') {
  if (after && !/^\d{1,30}$/.test(after)) throw new Error('Invalid deal cursor.')
  const metadata = await getMigrationDealMetadata(token)
  if (!metadata.pipelines.some(p => p.id === pipeline)) throw new Error('Select a valid HubSpot pipeline.')
  // List pagination avoids the 10,000-result cap of a single CRM search.
  const query = new URLSearchParams({ limit: '100', archived: 'false', properties: properties.join(','), associations: 'contacts' })
  if (after) query.set('after', after)
  const page = await request(token, `/crm/v3/objects/deals?${query}`)
  const selected = page.results.filter(row => row.properties.pipeline === pipeline)
  // Re-read selected deals explicitly; never replace a failed read with empty values.
  const refreshed = selected.length ? await request(token, '/crm/v3/objects/deals/batch/read', { properties, inputs: selected.map(row => ({ id: row.id })) }) : { results: [] }
  const byId = new Map(refreshed.results.map(row => [row.id, row.properties]))
  if (selected.some(row => !byId.has(row.id))) throw new Error('HubSpot did not return every deal. Retry to resume without losing rows.')
  const contactIds = [...new Set(selected.filter(row => !String(byId.get(row.id)?.phone ?? '').replace(/\D/g, '')).flatMap(row => (row.associations?.contacts?.results ?? []).map(contact => contact.id)))]
  const contacts = new Map()
  for (let offset = 0; offset < contactIds.length; offset += 100) {
    const result = await request(token, '/crm/v3/objects/contacts/batch/read', { properties: ['phone', 'mobilephone', 'email'], inputs: contactIds.slice(offset, offset + 100).map(id => ({ id })) })
    for (const contact of result.results) contacts.set(contact.id, contact.properties)
  }
  let recoveredPhone = 0
  const enriched = selected.map(row => {
    const p = { ...byId.get(row.id) }
    if (!String(p.phone ?? '').replace(/\D/g, '')) {
      for (const association of row.associations?.contacts?.results ?? []) {
        const contact = contacts.get(association.id)
        const phone = [contact?.phone, contact?.mobilephone, /^\d+@dummy\.com$/i.test(contact?.email ?? '') ? contact.email.split('@')[0] : ''].map(value => String(value ?? '').replace(/\D/g, '')).find(Boolean)
        if (phone) { p.phone = phone; recoveredPhone++; break }
      }
    }
    return migrationDeal(p, metadata)
  })
  const rows = enriched.filter(row => row[0] && row[3] && row[10])
  return { rows, scanned: page.results.length, missingPhone: enriched.filter(row => !row[3] || !row[10]).length, missingName: enriched.filter(row => !row[0]).length, recoveredPhone, missingPaidDate: rows.filter(row => !row[11]).length, withPaidDate: rows.filter(row => row[11]).length, after: page.paging?.next?.after ? String(page.paging.next.after) : null }
}
