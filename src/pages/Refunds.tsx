import { useCallback, useEffect, useMemo, useState } from 'react'

type RefundReport = {
  timezone: string
  weekly: Array<{ weekStart: string; weekEnd: string; sales: number; refunds: number; refundRate: number }>
  details: Array<{ id: string; dealName: string; refundDate: string; paidDate: string; saleAmount: number; refundAmount: number; refundRate: number; seller: string; type: string; observation: string }>
  totals: { sales: number; refunds: number; refundRate: number; refundCount: number }
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function defaultRange() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const value = new Date(`${today}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() - value.getUTCDay() - 1)
  const to = value.toISOString().slice(0, 10)
  return { from: shiftDate(to, -55), to }
}

function displayDate(value: string) {
  return value ? shortDate.format(new Date(`${value}T12:00:00Z`)) : '—'
}

function Refunds() {
  const initialRange = useMemo(defaultRange, [])
  const [fromDate, setFromDate] = useState(initialRange.from)
  const [toDate, setToDate] = useState(initialRange.to)
  const [report, setReport] = useState<RefundReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const response = await fetch(`/api/refunds-report?${params}`, { signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to load refunds.')
      setReport(payload as RefundReport)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Unable to load refunds.')
    } finally { if (!signal?.aborted) setIsLoading(false) }
  }, [fromDate, toDate])

  useEffect(() => {
    const controller = new AbortController()
    void fetchReport(controller.signal)
    return () => controller.abort()
  }, [fetchReport])

  const maxWeeklyAmount = Math.max(1, ...(report?.weekly ?? []).map((week) => Math.max(week.sales, week.refunds)))

  return (
    <main className="dashboard-shell refunds-page">
      <section className="refunds-panel" aria-labelledby="refunds-title">
        <header className="refunds-heading">
          <div><p className="eyebrow">Revenue adjustments</p><h1 id="refunds-title">Refunds</h1><p>Compare weekly revenue and refunds, then review every refunded deal.</p></div>
          <div className="refunds-date-controls">
            <label><span>From</span><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label><span>To</span><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <button type="button" disabled={isLoading || !fromDate || !toDate} onClick={() => void fetchReport()}>{isLoading ? 'Loading…' : 'Fetch'}</button>
          </div>
        </header>

        {error ? <div className="daily-error" role="alert">{error}</div> : null}
        <div className="refunds-summary" aria-label="Refund summary">
          <article><span>Total sales</span><strong>{money.format(report?.totals.sales ?? 0)}</strong><small>Paid deals in selected weeks</small></article>
          <article><span>Total refunded</span><strong>{money.format(report?.totals.refunds ?? 0)}</strong><small>{report?.totals.refundCount ?? 0} refunded deals</small></article>
          <article><span>Refund rate</span><strong>{(report?.totals.refundRate ?? 0).toFixed(2)}%</strong><small>Refunds ÷ total sales</small></article>
        </div>

        <section className="refunds-trend-card" aria-labelledby="refund-trend-title">
          <div className="refunds-table-title"><div><span>Week-over-week</span><strong id="refund-trend-title">Sales and refund trend</strong></div><small>Eastern Time</small></div>
          <div className="refunds-trend-body">
            <div className="refunds-chart" aria-label="Weekly sales and refund comparison">
              {(report?.weekly ?? []).map((week) => <div className="refunds-chart-week" key={week.weekStart}>
                <div className="refunds-chart-bars"><i className="sales" style={{ height: `${Math.max(3, week.sales / maxWeeklyAmount * 100)}%` }} title={`Sales ${money.format(week.sales)}`} /><i className="refund" style={{ height: `${Math.max(week.refunds ? 3 : 0, week.refunds / maxWeeklyAmount * 100)}%` }} title={`Refunds ${money.format(week.refunds)}`} /></div>
                <small>{displayDate(week.weekStart)}</small>
              </div>)}
            </div>
            <div className="refunds-chart-legend"><span><i className="sales" /> Sales</span><span><i className="refund" /> Refunds</span></div>
          </div>
          <div className="refunds-table-wrap"><table className="refunds-table refunds-weekly-table"><thead><tr><th>Week</th><th>Total sales amount</th><th>Total refund</th><th>Refund rate</th></tr></thead><tbody>
            {(report?.weekly ?? []).map((week) => <tr key={week.weekStart}><td>{displayDate(week.weekStart)} – {displayDate(week.weekEnd)}</td><td>{money.format(week.sales)}</td><td>{money.format(week.refunds)}</td><td><b className={week.refundRate > 3 ? 'refund-rate high' : 'refund-rate'}>{week.refundRate.toFixed(2)}%</b></td></tr>)}
          </tbody></table></div>
        </section>

        <section className="refunds-table-card" aria-labelledby="refunds-table-title">
          <div className="refunds-table-title"><div><span>Deal-level detail</span><strong id="refunds-table-title">Specific refunds</strong></div><small>{report?.details.length ?? 0} deals</small></div>
          <div className="refunds-table-wrap"><table className="refunds-table refunds-detail-table"><thead><tr><th>Refund date</th><th>Deal</th><th>Sales amount</th><th>Refund amount</th><th>Refund rate</th><th>Seller</th><th>Observation</th></tr></thead><tbody>
            {(report?.details ?? []).map((deal) => <tr key={deal.id}><td>{displayDate(deal.refundDate)}</td><td><strong>{deal.dealName}</strong><small>{deal.type ? `${deal.type} refund` : 'Refund'}</small></td><td>{money.format(deal.saleAmount)}</td><td className="refund-amount">{money.format(deal.refundAmount)}</td><td>{deal.refundRate.toFixed(2)}%</td><td>{deal.seller}</td><td>{deal.observation || '—'}</td></tr>)}
            {!isLoading && !report?.details.length ? <tr><td className="refunds-no-rows" colSpan={7}>No refunded deals were found in this date range.</td></tr> : null}
          </tbody></table></div>
        </section>
      </section>
    </main>
  )
}

export default Refunds
