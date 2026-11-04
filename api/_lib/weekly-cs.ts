export type CsSourceMetrics = {
  abandonedCart: Record<string, number>; repurchaseList: Record<string, number>; repurchaseNoAnswer: Record<string, number>
  details?: Record<string, Record<string, { sales: number; classifications: Record<string, number>; stages: Record<string, number> }>>
}
export function aggregateCsDeals(deals: Array<{ id: string; properties: Record<string, string | null | undefined> }>, ownerNames: Map<string, string>, stages: Map<string, string>): CsSourceMetrics {
  const result: CsSourceMetrics = { abandonedCart: {}, repurchaseList: {}, repurchaseNoAnswer: {}, details: {} }
  const seen = new Set<string>()
  for (const deal of deals) {
    if (seen.has(deal.id)) continue
    seen.add(deal.id)
    const p = deal.properties, classification = p.classification?.trim()
    if (!classification) continue
    const source = p.imported_source?.trim().toLowerCase()
    const key = source === 'repurchase list' ? 'repurchaseList' : source === 'abandoned cart' ? 'abandonedCart' : null
    if (!key) continue
    const seller = ownerNames.get(p.hubspot_owner_id ?? '') ?? 'Unassigned'
    result[key][seller] = (result[key][seller] ?? 0) + 1
    if (key === 'repurchaseList' && /^no response(?:\b|$)/i.test(classification)) result.repurchaseNoAnswer[seller] = (result.repurchaseNoAnswer[seller] ?? 0) + 1
    const stage = stages.get(p.dealstage ?? '') ?? p.dealstage ?? 'Unknown'
    const detail = ((result.details![key] ??= {})[seller] ??= { sales: 0, classifications: {}, stages: {} })
    detail.classifications[classification] = (detail.classifications[classification] ?? 0) + 1
    detail.stages[stage] = (detail.stages[stage] ?? 0) + 1
    if (/^(paid|medically approved \(won\))$/i.test(stage.trim()) || /^completed purchase$/i.test(classification)) detail.sales++
  }
  return result
}
