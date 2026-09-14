import { useEffect, useState } from 'react'

const earliestShopifyDate = '2026-09-01'
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function getApiUrl(path: string) {
  if (import.meta.env.DEV) return path
  return configuredApiBaseUrl ? `${configuredApiBaseUrl}${path}` : path
}

type ShopifyOrderRow = {
  shopify_order_id: string
  shopify_lineitem_id: string
  order_date: string
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

type ShopifySalesRow = {
  id: string
  name: string
  gross_sales: number | null
  discounts: number | null
  returns: number | null
  net_sales: number | null
  shipping_charges: number | null
  total_sales: number | null
  qty: number
  sales: number
  product_name: string
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

const shopifyHeaders = [
  'Name',
  'Gross sales',
  'Discounts',
  'Returns',
  'Net sales',
  'Shipping charges',
  'Total sales',
  'Qty',
  'Sales',
  'Product Name',
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

function OrderCalendar({ selected, savedDates, onSelect }: { selected: string; savedDates: Set<string>; onSelect: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date(`${selected}T12:00:00`))
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  const currentMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
  const makeDate = (day: number) => `${currentMonth}-${String(day).padStart(2, '0')}`

  return <div className="shopify-calendar">
    <button className={`shopify-calendar-trigger${savedDates.has(selected) ? ' saved' : ''}`} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      {new Date(`${selected}T12:00:00`).toLocaleDateString('en-US')}<span aria-hidden="true">▾</span>
    </button>
    {open ? <div className="shopify-calendar-popover">
      <header><strong>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><span>
        <button type="button" disabled={currentMonth <= earliestShopifyDate.slice(0, 7)} onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="Previous month">‹</button>
        <button type="button" disabled={currentMonth >= getToday().slice(0, 7)} onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="Next month">›</button>
      </span></header>
      <div className="shopify-calendar-weekdays">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <b key={day}>{day}</b>)}</div>
      <div className="shopify-calendar-days">{cells.map((day, index) => day === null ? <i key={`blank-${index}`} /> : (() => {
        const date = makeDate(day)
        return <button className={`${date === selected ? 'selected ' : ''}${savedDates.has(date) ? 'saved' : ''}`} type="button" key={date} disabled={date < earliestShopifyDate || date > getToday()} onClick={() => { onSelect(date); setOpen(false) }}>{day}</button>
      })())}</div>
      <small><i /> Gold dates have saved data</small>
    </div> : null}
  </div>
}

export default function Supplements() {
  const [dateInput, setDateInput] = useState(getToday())
  const [reportDate, setReportDate] = useState(getToday())
  const [view, setView] = useState<SupplementsView>('daily')
  const [ordersDate, setOrdersDate] = useState(getToday())
  const [savedOrderDates, setSavedOrderDates] = useState<Set<string>>(new Set())
  const [orderRows, setOrderRows] = useState<ShopifyOrderRow[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [ordersMessage, setOrdersMessage] = useState('')
  const [shopifyDate, setShopifyDate] = useState(getToday())
  const [shopifyRows, setShopifyRows] = useState<ShopifySalesRow[]>([])
  const [shopifyLoading, setShopifyLoading] = useState(false)
  const [shopifyError, setShopifyError] = useState('')
  const [shopifyMessage, setShopifyMessage] = useState('')
  const activeView = supplementViews.find((item) => item.key === view) ?? supplementViews[0]

  useEffect(() => {
    if (view !== 'orders') return
    void fetch(getApiUrl('/api/shopify/orders?dates=1'))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load saved dates')))
      .then((payload: { dates?: string[] }) => setSavedOrderDates(new Set(payload.dates ?? [])))
      .catch(() => undefined)
  }, [view])

  async function fetchOrders() {
    setOrdersLoading(true)
    setOrdersError('')
    setOrdersMessage('')
    try {
      const response = await fetch(getApiUrl('/api/shopify/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: ordersDate }),
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
      setSavedOrderDates((dates) => new Set(dates).add(ordersDate))
      setOrdersMessage(`${rows.length} line item${rows.length === 1 ? '' : 's'} fetched and saved.`)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to fetch Shopify orders.')
    } finally {
      setOrdersLoading(false)
    }
  }

  async function viewSavedOrders() {
    setOrdersLoading(true)
    setOrdersError('')
    setOrdersMessage('')
    try {
      const response = await fetch(getApiUrl(`/api/shopify/orders?date=${encodeURIComponent(ordersDate)}`))
      const responseText = await response.text()
      let payload: { rows?: ShopifyOrderRow[]; message?: string } = {}
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as typeof payload
        } catch {
          throw new Error(`The order history endpoint returned an invalid response (${response.status}).`)
        }
      }
      if (!response.ok) throw new Error(payload.message || `Unable to view saved orders (${response.status}).`)
      const rows = payload.rows ?? []
      setOrderRows(rows)
      setOrdersMessage(rows.length
        ? `${rows.length} saved line item${rows.length === 1 ? '' : 's'} loaded for ${ordersDate}.`
        : `No saved Shopify data exists for ${ordersDate}.`)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Unable to view saved orders.')
    } finally {
      setOrdersLoading(false)
    }
  }

  async function fetchShopifyReport() {
    setShopifyLoading(true)
    setShopifyError('')
    setShopifyMessage('')
    try {
      const response = await fetch(getApiUrl('/api/shopify/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: shopifyDate }),
      })
      const responseText = await response.text()
      let payload: { rows?: ShopifySalesRow[]; message?: string } = {}
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as typeof payload
        } catch {
          throw new Error(`The Shopify sales endpoint returned an invalid response (${response.status}).`)
        }
      }
      if (!response.ok) {
        const deploymentHint = response.status === 404
          ? ' The Shopify sales backend route has not been deployed yet.'
          : ''
        throw new Error(payload.message || `Unable to fetch Shopify sales (${response.status}).${deploymentHint}`)
      }
      if (!responseText) throw new Error('The Shopify sales endpoint returned an empty response.')
      const rows = payload.rows ?? []
      setShopifyRows(rows)
      setShopifyMessage(`${rows.length} sales line item${rows.length === 1 ? '' : 's'} loaded.`)
    } catch (error) {
      setShopifyError(error instanceof Error ? error.message : 'Unable to fetch Shopify sales.')
    } finally {
      setShopifyLoading(false)
    }
  }

  function formatShopifyAmount(value: number | null) {
    return value == null ? '' : value.toFixed(2)
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
        </div></> : view === 'shopify' ? <section className="supplements-content" aria-labelledby="supplements-shopify-title">
          <div className="supplements-table-heading">
            <div><span>Shopify export</span><h2 id="supplements-shopify-title">Shopify</h2></div>
          </div>
          <form className="supplements-orders-filter" onSubmit={(event) => { event.preventDefault(); void fetchShopifyReport() }}>
            <div className="supplements-orders-date-control"><span>Report date</span>
              <OrderCalendar selected={shopifyDate} savedDates={new Set()} onSelect={(date) => {
                setShopifyDate(date)
                setShopifyRows([])
                setShopifyMessage('')
                setShopifyError('')
              }} />
            </div>
            <button type="submit" disabled={shopifyLoading}>{shopifyLoading ? 'Working…' : 'Fetch Shopify'}</button>
          </form>
          {shopifyError ? <p className="supplements-orders-feedback error" role="alert">{shopifyError}</p> : null}
          {shopifyMessage ? <p className="supplements-orders-feedback success" role="status">{shopifyMessage}</p> : null}
          <div className="supplements-table-wrap">
            <table className="supplements-table supplements-orders-table supplements-shopify-table">
              <thead><tr>{shopifyHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
              <tbody>{shopifyRows.map((row) => <tr key={row.id}>
                <td>{row.name}</td>
                <td>{formatShopifyAmount(row.gross_sales)}</td>
                <td>{formatShopifyAmount(row.discounts)}</td>
                <td>{formatShopifyAmount(row.returns)}</td>
                <td>{formatShopifyAmount(row.net_sales)}</td>
                <td>{formatShopifyAmount(row.shipping_charges)}</td>
                <td>{formatShopifyAmount(row.total_sales)}</td>
                <td>{row.qty}</td>
                <td>{formatShopifyAmount(row.sales)}</td>
                <td title={row.product_name}>{row.product_name}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section> : view === 'orders' ? <section className="supplements-content" aria-labelledby="supplements-orders-title">
          <div className="supplements-table-heading">
            <div><span>Shopify export</span><h2 id="supplements-orders-title">Orders</h2></div>
          </div>
          <form className="supplements-orders-filter" onSubmit={(event) => event.preventDefault()}>
            <div className="supplements-orders-date-control"><span>Order date</span>
              <OrderCalendar selected={ordersDate} savedDates={savedOrderDates} onSelect={(date) => {
                setOrdersDate(date)
                setOrderRows([])
                setOrdersMessage('')
                setOrdersError('')
              }} />
            </div>
            <button type="button" onClick={() => void fetchOrders()} disabled={ordersLoading}>{ordersLoading ? 'Working…' : 'Fetch orders'}</button>
            <button className="view" type="button" onClick={() => void viewSavedOrders()} disabled={ordersLoading}>View</button>
          </form>
          {ordersError ? <p className="supplements-orders-feedback error" role="alert">{ordersError}</p> : null}
          {ordersMessage ? <p className="supplements-orders-feedback success" role="status">{ordersMessage}</p> : null}
          <div className="supplements-table-wrap">
            <table className="supplements-table supplements-orders-table">
              <thead><tr>{orderHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {orderRows.length ? orderRows.map((row) => <tr key={`${row.shopify_order_id}-${row.shopify_lineitem_id}`}>
                  <td title={row.name}>{row.name}</td>
                  <td title={row.email || undefined}>{row.email || '—'}</td>
                  <td title={row.financial_status.replaceAll('_', ' ')}>{row.financial_status.replaceAll('_', ' ')}</td>
                  <td title={row.paid_at ? new Date(row.paid_at).toLocaleString() : undefined}>{row.paid_at ? new Date(row.paid_at).toLocaleString() : '—'}</td>
                  <td>{row.lineitem_quantity}</td>
                  <td title={row.lineitem_name}>{row.lineitem_name}</td>
                  <td>{row.lineitem_price.toFixed(2)}</td>
                  <td>{row.lineitem_compare_at_price?.toFixed(2) ?? '—'}</td>
                  <td title={row.lineitem_sku || undefined}>{row.lineitem_sku || '—'}</td>
                </tr>) : <tr className="supplements-placeholder-row">
                  <td colSpan={orderHeaders.length}>Choose a date and fetch that day's Shopify orders.</td>
                </tr>}
              </tbody>
            </table>
          </div>
          <p className="supplements-note"><span /> Fetch replaces that date's saved snapshot. View loads historical data without contacting Shopify.</p>
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
