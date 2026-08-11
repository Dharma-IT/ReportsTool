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
type ReportRange = 'daily' | 'range'

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

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function datesBetween(start: string, end: string) {
  const dates: string[] = []
  for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date)
  return dates
}

function mergeReports(reports: FinanceResponse[], reportDate: string): FinanceResponse {
  const rows = new Map<string, FinanceRow>()
  for (const report of reports) {
    for (const row of report.rows) {
      const key = `${row.category}|${row.product}`
      const current = rows.get(key) ?? { ...row, quantity: 0, revenue: 0, cogs: 0 }
      current.quantity += row.quantity
      current.revenue += row.revenue
      current.cogs += row.cogs
      rows.set(key, current)
    }
  }
  return {
    reportDate,
    dealCount: reports.reduce((sum, report) => sum + report.dealCount, 0),
    stripeExcludedCount: reports.reduce((sum, report) => sum + (report.stripeExcludedCount ?? 0), 0),
    rows: [...rows.values()],
    totalRevenue: reports.reduce((sum, report) => sum + report.totalRevenue, 0),
    cogs: reports.reduce((sum, report) => sum + report.cogs, 0),
    adsCostMeta: reports.reduce((sum, report) => sum + report.adsCostMeta, 0),
    adsCostTiktok: reports.reduce((sum, report) => sum + report.adsCostTiktok, 0),
    revenueLoss: reports.reduce((total, report) => ({
      cancelled: total.cancelled + report.revenueLoss.cancelled,
      dispute: total.dispute + report.revenueLoss.dispute,
      refund: total.refund + report.revenueLoss.refund,
    }), { cancelled: 0, dispute: 0, refund: 0 }),
  }
}

function calculateNet(report: FinanceResponse | null) {
  if (!report) return 0
  const grossProfit = report.totalRevenue - report.cogs
  return grossProfit - grossProfit * 0.55 - report.adsCostMeta - report.adsCostTiktok
}

function displayMoney(value: number, dashWhenZero = false) {
  if (dashWhenZero && !value) return <><span className="currency-symbol">$</span><span>-</span></>
  const formatted = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <><span className="currency-symbol">$</span><span>{value < 0 ? `(${formatted})` : formatted}</span></>
}

function FinanceReport() {
  const yesterday = shiftDate(getNewYorkDate(), -1)
  const [reportDate, setReportDate] = useState(yesterday)
  const [rangeStartDate, setRangeStartDate] = useState(`${yesterday.slice(0, 7)}-01`)
  const [range, setRange] = useState<ReportRange>('daily')
  const [report, setReport] = useState<FinanceResponse | null>(null)
  const [monthToDateReport, setMonthToDateReport] = useState<FinanceResponse | null>(null)
  const [rangeStart, setRangeStart] = useState('')
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
      const endDate = range === 'daily' ? yesterday : reportDate
      const selectedDates = range === 'daily' ? [yesterday] : datesBetween(rangeStartDate, endDate)
      const monthDates = datesBetween(`${endDate.slice(0, 7)}-01`, endDate)
      const allDates = [...new Set([...selectedDates, ...monthDates])]
      const entries: Array<readonly [string, FinanceResponse]> = []
      for (let index = 0; index < allDates.length; index += 3) {
        const batch = await Promise.all(allDates.slice(index, index + 3).map(async (date) => {
          const response = await fetch(getApiUrl(`/api/finance-report?date=${encodeURIComponent(date)}`))
          const contentType = response.headers.get('content-type') ?? ''
          if (!contentType.includes('application/json')) throw new Error('The Finance API is not available on the deployed server yet. Redeploy the latest server version, then click Apply again.')
          const payload = await response.json() as FinanceResponse
          if (!response.ok) throw new Error(payload.message || `Unable to load the finance report for ${date}.`)
          return [date, payload] as const
        }))
        entries.push(...batch)
      }
      const byDate = new Map(entries)
      const selectedReport = mergeReports(selectedDates.map((date) => byDate.get(date)!), endDate)
      const mtdReport = mergeReports(monthDates.map((date) => byDate.get(date)!), endDate)
      setReport(selectedReport)
      setMonthToDateReport(mtdReport)
      setRangeStart(selectedDates[0])
      setAdsCostMeta(selectedReport.adsCostMeta ?? 0)
      setAdsCostTiktok(selectedReport.adsCostTiktok ?? 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the finance report.')
    } finally {
      setIsLoading(false)
    }
  }

  const activeEndDate = range === 'daily' ? yesterday : reportDate
  const rangeLabel = range === 'daily' ? 'Daily' : 'Date Range'
  const monthToDateNet = calculateNet(monthToDateReport)

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
            <h1 id="finance-report-title">Finance<br /><em>report.</em></h1>
            <p>Paid revenue, product performance, costs, and profitability—brought together from HubSpot and your campaign reports.</p>
            <div className="finance-source-row"><span><i /> HubSpot revenue</span><span><i /> Meta spend</span><span><i /> TikTok spend</span></div>
          </div>
          <ReportHeroVisual variant="finance" />
        </div>
        <div className="finance-report-layout">
          <aside className="finance-range-sidebar" aria-label="Finance report range">
            <span>Report range</span>
            {(['daily', 'range'] as ReportRange[]).map((option) => (
              <button key={option} type="button" className={range === option ? 'active' : ''} onClick={() => setRange(option)}>
                <strong>{option === 'daily' ? 'Daily' : 'Date Range'}</strong>
                <small>{option === 'daily' ? 'Always yesterday' : 'Choose start and end'}</small>
              </button>
            ))}
          </aside>
          <div className="finance-report-content">
        <div className="finance-toolbar">
          <div className="finance-toolbar-copy"><span>{rangeLabel} report controls</span><strong>{range === 'daily' ? 'Yesterday’s business report' : 'Select a custom date range'}</strong></div>
          <div className="finance-date-row">
            {range === 'daily' ? <>
              <label htmlFor="finance-report-date">Report date</label>
              <input id="finance-report-date" type="date" value={yesterday} readOnly aria-readonly="true" />
            </> : <>
              <label htmlFor="finance-range-start">Start date</label>
              <input id="finance-range-start" type="date" value={rangeStartDate} max={reportDate} onChange={(event) => setRangeStartDate(event.target.value)} />
              <label htmlFor="finance-report-date">End date</label>
              <input id="finance-report-date" type="date" value={reportDate} min={rangeStartDate} max={yesterday} onChange={(event) => setReportDate(event.target.value)} />
            </>}
            <button type="button" onClick={fetchReport} disabled={isLoading || !activeEndDate || (range === 'range' && (!rangeStartDate || rangeStartDate > reportDate))}>
              {isLoading ? 'Applying…' : 'Apply'}
            </button>
            <span>{isLoading ? 'Loading HubSpot and Stripe…' : report
              ? `${rangeStart}${rangeStart !== activeEndDate ? ` – ${activeEndDate}` : ''} · ${report.dealCount} paid deals · ${report.stripeExcludedCount ?? 0} excluded by Stripe`
              : ''}</span>
          </div>
        </div>
        {error && <p className="finance-error" role="alert">{error}</p>}
        <div className="finance-summary-grid" aria-label="Finance summary">
          <article><span className="finance-metric-icon revenue">↗</span><div><small>Total revenue</small><strong>{displayMoney(totals.revenue)}</strong><p>Paid product revenue</p></div></article>
          <article><span className="finance-metric-icon gross">◆</span><div><small>Gross profit</small><strong>{displayMoney(totals.grossProfit)}</strong><p>{percent(totals.grossProfit, totals.revenue)} of revenue</p></div></article>
          <article><span className="finance-metric-icon spend">$</span><div><small>Advertising spend</small><strong>{displayMoney(adsCostMeta + adsCostTiktok)}</strong><p>Meta + TikTok</p></div></article>
          <article className="net"><span className="finance-metric-icon net">●</span><div><small>{rangeLabel} net profit</small><strong>{displayMoney(totals.netProfit)}</strong><p>{percent(totals.netProfit, totals.revenue)} net margin</p></div></article>
          <article className="approximated"><span className="finance-metric-icon gross">≈</span><div><small>Approximated Net Profit</small><strong>{displayMoney(monthToDateNet)}</strong><p>{report ? `${activeEndDate.slice(0, 7)}-01 through ${activeEndDate}` : 'Month to selected date'}</p></div></article>
        </div>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <caption>{rangeLabel} Finance Report{report ? ` · ${rangeStart}${rangeStart !== activeEndDate ? ` – ${activeEndDate}` : ''}` : ''}</caption>
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
          </div>
        </div>
      </section>
    </main>
  )
}

export default FinanceReport
