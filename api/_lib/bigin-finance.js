import { getBiginTransactions, getBiginItems, validateTransactionQuery } from './bigin-transactions.js'
const round = value => Math.round((value + Number.EPSILON) * 100) / 100
export function normalizeBiginFinanceProduct(name) {
  const lower = name.toLowerCase()
  if (lower.includes('subscription') || lower.includes('membership')) return { category: 'Subscription', product: name }
  if (lower.includes('lipo mino')) return { category: 'Medication/Treatment', product: 'Lipo Mino' }
  if (lower.includes('metformin')) return { category: 'Medication/Treatment', product: 'Metformin' }
  if (lower.includes('nad+')) return { category: 'Medication/Treatment', product: 'NAD+' }
  if (lower.includes('nutrition consultation')) return { category: 'Medication/Treatment', product: 'Nutritional Consultation' }
  if (lower.includes('semaglutide')) return { category: 'Medication/Treatment', product: 'Semaglutide' }
  if (lower.includes('tirzepatide')) return { category: 'Medication/Treatment', product: 'Tirzepatide' }
  return { category: 'Supplements', product: name }
}
export function aggregateBiginFinance(paid, refunds, items, reportDate, spend = { meta: 0, tiktok: 0 }) {
  const productRows = new Map()
  const eligible = new Map(paid.filter(deal => deal.stage === 'PAID' && deal.paidDate === reportDate).map(deal => [deal.id, deal]))
  for (const item of items) {
    if (!eligible.has(item.dealId) || item.source !== 'Linked product' || item.itemAmount === null) continue
    const { category, product } = normalizeBiginFinanceProduct(item.name)
    const key = `${category}|${product.toLowerCase()}`
    const row = productRows.get(key) || { category, product, quantity: 0, revenue: 0, cogs: 0 }
    row.quantity += item.quantity ?? 0
    row.revenue = round(row.revenue + item.itemAmount)
    productRows.set(key, row)
  }
  // Bigin stores installment charges separately from Amount. Count them once
  // per paid deal, including deals with no linked products.
  const paidRevenue = round([...eligible.values()].reduce((sum, deal) => sum + deal.amount + (Number.isFinite(deal.installmentFee) ? deal.installmentFee : 0), 0))
  const refundDeals = [...new Map(refunds.filter(deal => deal.stage === 'Refund' && deal.paidDate === reportDate).map(deal => [deal.id, deal])).values()]
  const refundLoss = -round(refundDeals.reduce((sum, deal) => sum + Math.abs(deal.amount), 0))
  const allocatedRevenue = round([...productRows.values()].reduce((sum, row) => sum + row.revenue, 0))
  const reconciliationDifference = round(paidRevenue - allocatedRevenue)
  if (Math.abs(reconciliationDifference) > 0.005) productRows.set('reconciliation', { category: 'Others', product: 'Taxes / Fees / Unallocated Revenue', quantity: 0, revenue: reconciliationDifference, cogs: 0 })
  const totalRevenue = round(paidRevenue + refundLoss)
  return {
    reportDate, timezone: 'America/New_York', dealCount: eligible.size, refundCount: refundDeals.length,
    rows: [...productRows.values()], totalRevenue, paidRevenue, allocatedRevenue, reconciliationDifference,
    cogs: round(Math.max(0, paidRevenue) * 0.32), cogsEstimated: true,
    adsCostMeta: round(spend.meta), adsCostTiktok: round(spend.tiktok),
    revenueLoss: { cancelled: 0, dispute: 0, refund: refundLoss },
  }
}
async function savedSpend(date, env) {
  const base = env.VITE_SUPABASE_URL?.replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Saved ad-spend reporting is not configured.')
  const rest = base.endsWith('/rest/v1') ? base : `${base}/rest/v1`
  const response = await fetch(`${rest}/meta_budget_reports?select=meta_total_spending,tiktok_total_spending&report_date=eq.${date}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('Unable to read saved ad spend for the Bigin finance report.')
  const rows = await response.json()
  return { meta: Number(rows[0]?.meta_total_spending || 0), tiktok: Number(rows[0]?.tiktok_total_spending || 0) }
}
const reports = new Map()
export async function getBiginFinance(query, env = process.env) {
  const date = query.get('date') || ''
  validateTransactionQuery(new URLSearchParams({ from: date, to: date, pipeline: 'New Leads' }))
  const key = [env.BIGIN_CLIENT_ID, env.BIGIN_REFRESH_TOKEN, env.VITE_SUPABASE_URL, date].join('|')
  const cached = reports.get(key)
  if (cached && cached.expires > Date.now()) return cached.promise
  const promise = (async () => {
    const paid = [], refunds = []
    const spend = await savedSpend(date, env)
    for (const pipeline of ['New Leads', 'Customer Service']) {
      for (const report of ['paid', 'refunds']) {
        for (let page = 1; page <= 10; page++) {
          const result = await getBiginTransactions(new URLSearchParams({ from: date, to: date, pipeline, report, page: String(page) }), env)
          ;(report === 'paid' ? paid : refunds).push(...result.rows)
          if (!result.more) break
        }
      }
    }
    const unique = [...new Map(paid.map(deal => [deal.id, deal])).values()]
    const items = []
    for (let index = 0; index < unique.length; index += 20) {
      const result = await getBiginItems(new URLSearchParams({ ids: unique.slice(index, index + 20).map(deal => deal.id).join(',') }), env)
      items.push(...result.items)
    }
    return aggregateBiginFinance(unique, refunds, items, date, spend)
  })()
  reports.set(key, { promise, expires: Date.now() + 120000 })
  if (reports.size > 100) reports.delete(reports.keys().next().value)
  try { return await promise } catch (error) { reports.delete(key); throw error }
}
