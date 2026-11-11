const properties = ['dealname', 'meeting_type', 'evaluation_date_and_hour_2', 'phone', 'agent_lead_management', 'classification', 'dealstage', 'closedate', 'hubspot_owner_id', 'amount', 'paid_date_all_pipelines', 'pipeline']
let cached
async function request(token, path) {
  if (!token) throw new Error('Missing HUBSPOT_ACCESS_TOKEN on the server.')
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://api.hubapi.com${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
    if (response.ok) return response.json()
    if (attempt === 3 || (response.status !== 429 && response.status < 500)) throw new Error(`HubSpot request failed (${response.status}). Retry to resume.`)
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
  }
}
export async function getMigrationDealMetadata(token) {
  if (cached?.token === token && cached.expires > Date.now()) return cached.value
  const [pipelines, fields] = await Promise.all([request(token, '/crm/v3/pipelines/deals'), request(token, '/crm/v3/properties/deals')])
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
  return [String(p.dealname ?? '').replace(/^\s*(?:new\s+sale|cs|sellers)\s*[-–—:]\s*/i, '').trim(), label('meeting_type'), p.evaluation_date_and_hour_2 ?? '', phone, label('agent_lead_management'), label('classification'), stage, (p.closedate ?? '').slice(0, 10), metadata.owners[p.hubspot_owner_id] ?? p.hubspot_owner_id ?? '', p.amount ?? '', phone ? `${phone}@dummy.com` : '', (p.paid_date_all_pipelines ?? '').slice(0, 10)]
}
export async function getMigrationDealPage(token, pipeline, after = '') {
  if (after && !/^\d{1,30}$/.test(after)) throw new Error('Invalid deal cursor.')
  const metadata = await getMigrationDealMetadata(token)
  if (!metadata.pipelines.some(p => p.id === pipeline)) throw new Error('Select a valid HubSpot pipeline.')
  // List pagination avoids the 10,000-result cap of a single CRM search.
  const query = new URLSearchParams({ limit: '100', archived: 'false', properties: properties.join(',') })
  if (after) query.set('after', after)
  const page = await request(token, `/crm/v3/objects/deals?${query}`)
  const selected = page.results.filter(row => row.properties.pipeline === pipeline)
  const rows = selected.map(row => migrationDeal(row.properties, metadata))
  return { rows, scanned: page.results.length, missingPhone: rows.filter(row => !row[3]).length, missingName: rows.filter(row => !row[0]).length, after: page.paging?.next?.after ? String(page.paging.next.after) : null }
}
