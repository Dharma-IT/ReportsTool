import { useState } from 'react'

const dailyExpenses = [
  'Meta Ads',
  'TikTok Ads',
  'Google Ads',
  'Shipping Fee',
  'Fulfillment Fee',
  'Processing Fee (Supliful)',
  'Processing Fee (Shopify)',
  'Cost of Goods Sold',
]

type SupplementsView = 'daily' | 'ads' | 'cogs' | 'shopify' | 'orders' | 'sales'

const supplementViews: Array<{ key: SupplementsView; label: string; short: string; detail: string }> = [
  { key: 'daily', label: 'Report Daily', short: 'RD', detail: 'Daily finance overview' },
  { key: 'ads', label: 'ADS', short: 'AD', detail: 'Advertising spend' },
  { key: 'cogs', label: 'COGS & FEE', short: 'CF', detail: 'Costs and fees' },
  { key: 'shopify', label: 'Shopify', short: 'SH', detail: 'Store performance' },
  { key: 'orders', label: 'Orders', short: 'OR', detail: 'Order reporting' },
  { key: 'sales', label: 'Total sales by order', short: 'TS', detail: 'Order-level sales' },
]

function getToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function EmptyAmount() {
  return <span className="supplements-empty" aria-label="No data">—</span>
}

export default function Supplements() {
  const [dateInput, setDateInput] = useState(getToday())
  const [reportDate, setReportDate] = useState(getToday())
  const [view, setView] = useState<SupplementsView>('daily')
  const activeView = supplementViews.find((item) => item.key === view) ?? supplementViews[0]

  return (
    <main className="dashboard-shell supplements-page supplements-layout">
      <aside className="supplements-sidebar" aria-label="Supplements report sections">
        <span>Report section</span>
        {supplementViews.map((item) => (
          <button className={view === item.key ? 'active' : ''} key={item.key} type="button" onClick={() => setView(item.key)}>
            <b>{item.short}</b><span>{item.label}<small>{item.detail}</small></span>
          </button>
        ))}
      </aside>
      <section className="supplements-panel" aria-labelledby="supplements-title">
        <header className="supplements-hero">
          <div>
            <p className="supplements-eyebrow"><span /> Finance intelligence</p>
            <h1 id="supplements-title">Supplements<br /><em>report.</em></h1>
            <p>Daily sales, operating spend, and month-to-date profitability for Dharma Supplements.</p>
          </div>
          <div className="supplements-hero-mark" aria-hidden="true"><span>$</span><i /><i /><i /></div>
        </header>

        {view === 'daily' ? <><div className="supplements-toolbar">
          <div><span>Report controls</span><strong>Select a reporting date</strong></div>
          <form onSubmit={(event) => { event.preventDefault(); setReportDate(dateInput) }}>
            <label htmlFor="supplements-date">Report date</label>
            <input id="supplements-date" type="date" value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
            <button type="submit" disabled={!dateInput}>Apply</button>
          </form>
        </div>

        <div className="supplements-content">
          <div className="supplements-table-heading">
            <div><span>Daily overview</span><h2>Dharma Supplements Finance Report</h2></div>
            <time dateTime={reportDate}>{new Date(`${reportDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
          </div>
          <div className="supplements-table-wrap">
            <table className="supplements-table">
              <thead><tr><th scope="col">Description</th><th scope="col">Qty. Sold</th><th scope="col">Sales Amount</th></tr></thead>
              <tbody>
                <tr><th scope="row">Shopify Sales Daily</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                <tr className="supplements-total"><th scope="row">Gross Profit Daily</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                {dailyExpenses.map((label) => <tr key={label}><th scope="row">{label}</th><td /><td><EmptyAmount /></td></tr>)}
                <tr className="supplements-total"><th scope="row">Total Spend Daily</th><td /><td><EmptyAmount /></td></tr>
                <tr className="supplements-net"><th scope="row">Net Profit Daily</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                <tr className="supplements-month"><th scope="row">Gross Profit Monthly</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                <tr><th scope="row">Spend Monthly <small>(ads, GMV Max &amp; fees)</small></th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                <tr className="supplements-net"><th scope="row">Net Profit Monthly</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
              </tbody>
            </table>
          </div>
          <p className="supplements-note"><span /> No supplement data has been connected yet. Values will appear here once a source is available.</p>
        </div></> : <section className="supplements-progress" aria-labelledby="supplements-progress-title">
          <div className="supplements-progress-icon" aria-hidden="true">{activeView.short}</div>
          <p>Coming soon</p>
          <h2 id="supplements-progress-title">{activeView.label}</h2>
          <span>The {activeView.label} workspace is being prepared. Reporting controls and data will appear here once its source is connected.</span>
          <div className="supplements-progress-status"><i /> In progress</div>
        </section>}
      </section>
    </main>
  )
}
