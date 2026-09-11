import { useState } from 'react'

const earliestShopifyDate = '2026-09-01'
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function getApiUrl(path: string) {
  return configuredApiBaseUrl ? `${configuredApiBaseUrl}${path}` : path
}

type ShopifyOrderRow = {
  shopify_order_id: string
  shopify_lineitem_id: string
  name: string
  email: string | null
  financial_status: string
  paid_at: string | null
  lineitem_quantity: number
  lineitem_name: string
  lineitem_price: number
  lineitem_compare_at_price: number | null
  lineitem_sku: string | null
}

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

const orderHeaders = [
  'Name',
  'Email',
  'Financial Status',
  'Paid at',
  'Lineitem quantity',
  'Lineitem name',
  'Lineitem price',
  'Lineitem compare at price',
  'Lineitem SKU',
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
  const [ordersFrom, setOrdersFrom] = useState(earliestShopifyDate)
  const [ordersTo, setOrdersTo] = useState(getToday())
  const [orderRows, setOrderRows] = useState<ShopifyOrderRow[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [ordersMessage, setOrdersMessage] = useState('')
  const activeView = supplementViews.find((item) => item.key === view) ?? supplementViews[0]

  async function fetchOrders() {
    setOrdersLoading(true)
    setOrdersError('')
    setOrdersMessage('')
    try {
      const response = await fetch(getApiUrl('/api/shopify/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: ordersFrom, to: ordersTo }),
      })
      const responseText = await response.text()
      let payload: { rows?: ShopifyOrderRow[]; message?: string } = {}
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as typeof payload
        } catch {
          throw new Error(`The Shopify endpoint returned an invalid response (${response.status}).`)
        }
      }
      if (!response.ok) {
        const deploymentHint = response.status === 404
          ? ' The Shopify backend route has not been deployed yet.'
          : ''
        throw new Error(payload.message || `Unable to fetch Shopify orders (${response.status}).${deploymentHint}`)
      }
      if (!responseText) throw new Error('The Shopify endpoint returned an empty response.')
      const rows = payload.rows ?? []
      setOrderRows(rows)
      setOrdersMessage(`${rows.length} line item${rows.length === 1 ? '' : 's'} fetched and saved.`)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to fetch Shopify orders.')
    } finally {
      setOrdersLoading(false)
    }
  }

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
        </div></> : view === 'orders' ? <section className="supplements-content" aria-labelledby="supplements-orders-title">
          <div className="supplements-table-heading">
            <div><span>Shopify export</span><h2 id="supplements-orders-title">Orders</h2></div>
          </div>
          <form className="supplements-orders-filter" onSubmit={(event) => { event.preventDefault(); void fetchOrders() }}>
            <label htmlFor="shopify-orders-from">From
              <input id="shopify-orders-from" type="date" min={earliestShopifyDate} max={ordersTo} value={ordersFrom} onChange={(event) => setOrdersFrom(event.target.value)} />
            </label>
            <label htmlFor="shopify-orders-to">To
              <input id="shopify-orders-to" type="date" min={ordersFrom || earliestShopifyDate} max={getToday()} value={ordersTo} onChange={(event) => setOrdersTo(event.target.value)} />
            </label>
            <button type="submit" disabled={ordersLoading || !ordersFrom || !ordersTo || ordersFrom < earliestShopifyDate || ordersFrom > ordersTo}>
              {ordersLoading ? 'Fetching…' : 'Fetch orders'}
            </button>
          </form>
          {ordersError ? <p className="supplements-orders-feedback error" role="alert">{ordersError}</p> : null}
          {ordersMessage ? <p className="supplements-orders-feedback success" role="status">{ordersMessage}</p> : null}
          <div className="supplements-table-wrap">
            <table className="supplements-table supplements-orders-table">
              <thead><tr>{orderHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {orderRows.length ? orderRows.map((row) => <tr key={`${row.shopify_order_id}-${row.shopify_lineitem_id}`}>
                  <td>{row.name}</td>
                  <td>{row.email || '—'}</td>
                  <td>{row.financial_status.replaceAll('_', ' ')}</td>
                  <td>{row.paid_at ? new Date(row.paid_at).toLocaleString() : '—'}</td>
                  <td>{row.lineitem_quantity}</td>
                  <td>{row.lineitem_name}</td>
                  <td>{row.lineitem_price.toFixed(2)}</td>
                  <td>{row.lineitem_compare_at_price?.toFixed(2) ?? '—'}</td>
                  <td>{row.lineitem_sku || '—'}</td>
                </tr>) : <tr className="supplements-placeholder-row">
                  <td colSpan={orderHeaders.length}>Choose a date range and fetch Shopify orders.</td>
                </tr>}
              </tbody>
            </table>
          </div>
          <p className="supplements-note"><span /> Available from September 1, 2026 onward. Fetching also saves the rows to Supabase.</p>
        </section> : <section className="supplements-progress" aria-labelledby="supplements-progress-title">
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
