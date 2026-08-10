import { useMemo, useState } from 'react'
import ReportHeroVisual from '../components/ReportHeroVisual'

type FinanceRow = { category: string; product: string; quantity: number; revenue: number; cogs: number }
type FinanceResponse = {
  reportDate: string
  dealCount: number
  stripeCheckedDate?: string
  stripeExcludedCount?: number
  rows: FinanceRow[]
  totalRevenue: number
  allocatedRevenue?: number
  reconciliationDifference?: number
  cogs: number
  adsCostMeta: number
  adsCostTiktok: number
  revenueLoss: { cancelled: number; dispute: number; refund: number }
  message?: string
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function getApiUrl(path: string) {
  const base = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : configuredApiBaseUrl
  return `${base}${path}`
}

function getNewYorkDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

const percent = (value: number, total: number) => total ? `${Math.round((value / total) * 100)}%` : '0%'
const productOrder = ['Lipo Mino', 'Metformin', 'NAD+', 'Nutritional Consultation', 'Semaglutide', 'Tirzepatide']

function displayMoney(value: number, dashWhenZero = false) {
  if (dashWhenZero && !value) return <><span className="currency-symbol">$</span><span>-</span></>
  const formatted = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <><span className="currency-symbol">$</span><span>{value < 0 ? `(${formatted})` : formatted}</span></>
}

function FinanceReport() {
  const [reportDate, setReportDate] = useState(getNewYorkDate)
  const [report, setReport] = useState<FinanceResponse | null>(null)
  const [adsCostMeta, setAdsCostMeta] = useState(0)
  const [adsCostTiktok, setAdsCostTiktok] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const totals = useMemo(() => {
    const revenue = report?.totalRevenue ?? 0
    const cogs = report?.cogs ?? 0
    const grossProfit = revenue - cogs
    const operationCost = grossProfit * 0.55
    return { revenue, cogs, grossProfit, netProfit: grossProfit - operationCost - adsCostMeta - adsCostTiktok }
  }, [report, adsCostMeta, adsCostTiktok])

  async function fetchReport() {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(getApiUrl(`/api/finance-report?date=${encodeURIComponent(reportDate)}`))
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error('The Finance API is not available on the deployed server yet. Redeploy the latest server version, then click Apply again.')
      }
      const payload = await response.json() as FinanceResponse
      if (!response.ok) throw new Error(payload.message || 'Unable to load the finance report.')
      setReport(payload)
      setAdsCostMeta(payload.adsCostMeta ?? 0)
      setAdsCostTiktok(payload.adsCostTiktok ?? 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the finance report.')
    } finally {
      setIsLoading(false)
    }
  }

  const displayRows = useMemo(() => {
    const rows = [...(report?.rows ?? [])]
    const normalized = new Map(rows.map((row) => [row.product.toLowerCase(), row]))
    const medicationRows = productOrder.map((product) => normalized.get(product.toLowerCase()) ?? {
      category: 'Medication/Treatment', product, quantity: 0, revenue: 0, cogs: 0,
    })
    const standardNames = new Set(productOrder.map((product) => product.toLowerCase()))
    const remaining = rows.filter((row) => !standardNames.has(row.product.toLowerCase()))
    const grouped = ['Subscription', 'Supplements', 'Others'].map((category) => {
      const matches = remaining.filter((row) => category === 'Others'
        ? !['Subscription', 'Supplements'].includes(row.category)
        : row.category === category)
      return {
        category, product: category === 'Others' ? 'Taxes / Fees / Unallocated Revenue' : '-',
        quantity: matches.reduce((sum, row) => sum + row.quantity, 0),
        revenue: matches.reduce((sum, row) => sum + row.revenue, 0),
        cogs: matches.reduce((sum, row) => sum + row.cogs, 0),
      }
    })
    return [...medicationRows, ...grouped]
  }, [report])

  return (
    <main className="dashboard-shell finance-report-page">
      <section className="finance-sheet finance-report-panel" aria-labelledby="finance-report-title">
        <div className="finance-report-heading">
          <div className="finance-heading-copy">
            <p className="eyebrow"><span /> Financial intelligence</p>
            <h1 id="finance-report-title">Daily finance<br /><em>report.</em></h1>
            <p>Paid revenue, product performance, costs, and profitability—brought together from HubSpot and your campaign reports.</p>
            <div className="finance-source-row"><span><i /> HubSpot revenue</span><span><i /> Meta spend</span><span><i /> TikTok spend</span></div>
          </div>
          <ReportHeroVisual variant="finance" />
        </div>
        <div className="finance-toolbar">
          <div className="finance-toolbar-copy"><span>Report controls</span><strong>Select a business date</strong></div>
          <div className="finance-date-row">
            <label htmlFor="finance-report-date">Report date</label>
            <input id="finance-report-date" type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
            <button type="button" onClick={fetchReport} disabled={isLoading || !reportDate}>
              {isLoading ? 'Applying…' : 'Apply'}
            </button>
            <span>{isLoading ? 'Loading HubSpot and Stripe…' : report
              ? `${report.dealCount} paid deals · ${report.stripeExcludedCount ?? 0} excluded by Stripe${report.stripeCheckedDate ? ` (${report.stripeCheckedDate})` : ''}`
              : ''}</span>
          </div>
        </div>
        {error && <p className="finance-error" role="alert">{error}</p>}
        <div className="finance-summary-grid" aria-label="Finance summary">
          <article><span className="finance-metric-icon revenue">↗</span><div><small>Total revenue</small><strong>{displayMoney(totals.revenue)}</strong><p>Paid product revenue</p></div></article>
          <article><span className="finance-metric-icon gross">◆</span><div><small>Gross profit</small><strong>{displayMoney(totals.grossProfit)}</strong><p>{percent(totals.grossProfit, totals.revenue)} of revenue</p></div></article>
          <article><span className="finance-metric-icon spend">$</span><div><small>Advertising spend</small><strong>{displayMoney(adsCostMeta + adsCostTiktok)}</strong><p>Meta + TikTok</p></div></article>
          <article className="net"><span className="finance-metric-icon net">●</span><div><small>Net profit</small><strong>{displayMoney(totals.netProfit)}</strong><p>{percent(totals.netProfit, totals.revenue)} net margin</p></div></article>
        </div>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <caption>Daily Finance Report</caption>
            <thead><tr><th>Category</th><th>Product</th><th>Qty.</th><th>Price</th><th>% Over Total</th></tr></thead>
            <tbody>
              {displayRows.map((row, index) => <tr key={`${row.category}-${row.product}-${index}`}><td>{row.category}</td><td>{row.product}</td><td>{row.quantity}</td><td className="money-cell">{displayMoney(row.revenue, true)}</td><td>{percent(row.revenue, totals.revenue)}</td></tr>)}
              <tr><td>Revenue Loss</td><td>Cancelled</td><td>0</td><td className="money-cell">{displayMoney(report?.revenueLoss.cancelled ?? 0, true)}</td><td /></tr>
              <tr><td>Revenue Loss</td><td>Dispute</td><td>0</td><td className="money-cell">{displayMoney(report?.revenueLoss.dispute ?? 0, true)}</td><td /></tr>
              <tr><td>Revenue Loss</td><td>Total Refund</td><td>0</td><td className="money-cell">{displayMoney(report?.revenueLoss.refund ?? 0, true)}</td><td /></tr>
              <tr className="finance-total"><td /><th>Total Revenue</th><td>-</td><th className="money-cell">{displayMoney(totals.revenue)}</th><td /></tr>
              <tr><td /><td>COGS</td><td /><td className="money-cell">{displayMoney(-totals.cogs)}</td><td>{percent(totals.cogs, totals.revenue)}</td></tr>
              <tr className="finance-total"><td /><th>Gross Profit</th><td>-</td><th className="money-cell">{displayMoney(totals.grossProfit)}</th><th>{percent(totals.grossProfit, totals.revenue)}</th></tr>
              <tr><td>Expenses</td><td>Operation Cost</td><td /><td className="money-cell">{displayMoney(totals.grossProfit * 0.55)}</td><td>{percent(totals.grossProfit * 0.55, totals.grossProfit)}</td></tr>
              <tr><td>Expenses</td><td>Ads Cost Meta</td><td /><td className="money-cell input-cell"><span className="currency-symbol">$</span><input className="finance-money-input" aria-label="Meta ads cost" type="number" min="0" step="0.01" value={adsCostMeta || ''} placeholder="0.00" onChange={(event) => setAdsCostMeta(Number(event.target.value))} /></td><td>{percent(adsCostMeta, totals.grossProfit)}</td></tr>
              <tr><td>Expenses</td><td>Ads Cost TikTok</td><td /><td className="money-cell input-cell"><span className="currency-symbol">$</span><input className="finance-money-input" aria-label="TikTok ads cost" type="number" min="0" step="0.01" value={adsCostTiktok || ''} placeholder="0.00" onChange={(event) => setAdsCostTiktok(Number(event.target.value))} /></td><td>{percent(adsCostTiktok, totals.grossProfit)}</td></tr>
              <tr className="finance-spacer"><td colSpan={5} /></tr>
              <tr className="finance-net"><td /><th>NET Profit</th><td /><th className="money-cell">{displayMoney(totals.netProfit)}</th><th>{percent(totals.netProfit, totals.revenue)}</th></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default FinanceReport
