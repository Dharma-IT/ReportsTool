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
  day: string
  sale_id: string
  order_name: string
  product_title: string
  line_gross_sales: number
  line_discounts: number
  line_returns: number
  line_net_sales: number
  line_shipping_charges: number
  line_return_fees: number
  line_taxes: number
  line_total_sales: number
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

type ShopifyHistoricalProductRow = {
  product: string
  qty: number
  sales_amount: number
}

type ShopifyCogsRow = {
  id: string
  date: string
  order: string
  product: string
  qty: number
  unit_price: number | null
  subtotal: number | null
  shipping: number
  fulfillment_supliful: number
  processing_supliful: number
  processing_shopify: number
  payout_received?: number
  total: number
}

type AdsSummaryRow = Record<'meta' | 'google' | 'tiktok' | 'cogs' | 'shipping' | 'fulfillment' | 'processing', string> & { date: string }
type SavedAdsRow = { report_date: string; meta: number; google: number; tiktok: number }

type FinanceTotals = {
  qty: number
  sales: number
  meta: number
  tiktok: number
  google: number
  cogs: number
  shipping: number
  fulfillment: number
  processingSupliful: number
  processingShopify: number
}

type FinanceOverview = { daily: FinanceTotals; monthly: FinanceTotals }

const emptyFinanceTotals = (): FinanceTotals => ({
  qty: 0, sales: 0, meta: 0, tiktok: 0, google: 0, cogs: 0, shipping: 0,
  fulfillment: 0, processingSupliful: 0, processingShopify: 0,
})

const emptyAdsSummary = (date: string): AdsSummaryRow => ({ date, meta: '', google: '', tiktok: '', cogs: '', shipping: '', fulfillment: '', processing: '' })

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

const totalSalesHeaders = ['Day', 'Sale ID', 'Order name', 'Product title', 'Gross sales', 'Discounts', 'Returns', 'Net sales', 'Shipping charges', 'Return fees', 'Taxes', 'Total sales']

const adsSummaryHeaders = [
  'Date',
  'Meta',
  'Google',
  'TikTok',
  'COGS',
  'Shipping',
  'Fulfillment',
  'Processing',
]

const cogsHeaders = ['Date', 'Order', 'Product', 'Qty', 'Unit Price', 'Subtotal', 'Shipping', 'Fulfillment (Supliful)', 'Process. (Supliful)', 'Process. (Shopify)', 'Total']
const cogsNumericFields = ['qty', 'unit_price', 'subtotal', 'shipping', 'fulfillment_supliful', 'processing_supliful', 'processing_shopify', 'total'] as const

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

function numericValue(value: string | number | null | undefined) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function summarizeFinance(salesRows: ShopifySalesRow[], cogsRows: ShopifyCogsRow[], ads?: AdsSummaryRow): FinanceTotals {
  return {
    qty: salesRows.reduce((sum, row) => sum + numericValue(row.qty), 0),
    // Shopify's order total is emitted once per order. Summing line totals can
    // double-count expanded multi-pack items and does not match Shopify Finance.
    sales: salesRows.reduce((sum, row) => sum + numericValue(row.total_sales), 0),
    meta: numericValue(ads?.meta),
    tiktok: numericValue(ads?.tiktok),
    google: numericValue(ads?.google),
    cogs: cogsRows.reduce((sum, row) => sum + numericValue(row.subtotal), 0),
    shipping: cogsRows.reduce((sum, row) => sum + numericValue(row.shipping), 0),
    fulfillment: cogsRows.reduce((sum, row) => sum + numericValue(row.fulfillment_supliful), 0),
    processingSupliful: cogsRows.reduce((sum, row) => sum + numericValue(row.processing_supliful), 0),
    processingShopify: cogsRows.reduce((sum, row) => sum + numericValue(row.processing_shopify), 0),
  }
}

function totalSpend(total: FinanceTotals) {
  return total.meta + total.tiktok + total.google + total.cogs + total.shipping + total.fulfillment
    + total.processingSupliful + total.processingShopify
}

function moneyAmount(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
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
  const [savedShopifyDates, setSavedShopifyDates] = useState<Set<string>>(new Set())
  const [shopifyRows, setShopifyRows] = useState<ShopifySalesRow[]>([])
  const [shopifyHistoricalRows, setShopifyHistoricalRows] = useState<ShopifyHistoricalProductRow[]>([])
  const [shopifyHistoryLoading, setShopifyHistoryLoading] = useState(false)
  const [shopifyHistoryUpdatedAt, setShopifyHistoryUpdatedAt] = useState('')
  const [shopifyLoading, setShopifyLoading] = useState(false)
  const [shopifyError, setShopifyError] = useState('')
  const [shopifyMessage, setShopifyMessage] = useState('')
  const [totalSalesDate, setTotalSalesDate] = useState(getToday())
  const [totalSalesRows, setTotalSalesRows] = useState<ShopifySalesRow[]>([])
  const [totalSalesLoading, setTotalSalesLoading] = useState(false)
  const [totalSalesMessage, setTotalSalesMessage] = useState('')
  const [totalSalesError, setTotalSalesError] = useState('')
  const [adsDate, setAdsDate] = useState(getToday())
  const [adsRows, setAdsRows] = useState<AdsSummaryRow[]>([])
  const [adsCostsLoading, setAdsCostsLoading] = useState(false)
  const [adsFeedback, setAdsFeedback] = useState('')
  const [adsError, setAdsError] = useState('')
  const [cogsDate, setCogsDate] = useState(getToday())
  const [savedCogsDates, setSavedCogsDates] = useState<Set<string>>(new Set())
  const [cogsRows, setCogsRows] = useState<ShopifyCogsRow[]>([])
  const [cogsLoading, setCogsLoading] = useState(false)
  const [cogsMessage, setCogsMessage] = useState('')
  const [cogsError, setCogsError] = useState('')
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewMessage, setOverviewMessage] = useState('')
  const [overviewError, setOverviewError] = useState('')
  const activeView = supplementViews.find((item) => item.key === view) ?? supplementViews[0]

  useEffect(() => {
    if (view !== 'orders') return
    void fetch(getApiUrl('/api/shopify/orders?dates=1'))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load saved dates')))
      .then((payload: { dates?: string[] }) => setSavedOrderDates(new Set(payload.dates ?? [])))
      .catch(() => undefined)
  }, [view])

  useEffect(() => {
    if (view !== 'shopify' && view !== 'sales') return
    void Promise.all([
      fetch(getApiUrl('/api/shopify/sales?dates=1')).then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load saved dates'))),
      fetch(getApiUrl('/api/shopify/sales?history=1')).then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load historical sales'))),
    ]).then(([dates, history]: [{ dates?: string[] }, { historicalRows?: ShopifyHistoricalProductRow[]; fetchedAt?: string }]) => {
      setSavedShopifyDates(new Set(dates.dates ?? []))
      setShopifyHistoricalRows(history.historicalRows ?? [])
      setShopifyHistoryUpdatedAt(history.fetchedAt ?? '')
    }).catch(() => undefined)
  }, [view])

  useEffect(() => {
    void fetch(getApiUrl('/api/supplements/ads'))
      .then(async (response) => {
        const payload = await response.json() as { rows?: SavedAdsRow[]; message?: string }
        if (!response.ok) throw new Error(payload.message || 'Unable to load saved ADS data')
        return payload.rows ?? []
      })
      .then((rows) => setAdsRows(rows.map((row) => ({
        ...emptyAdsSummary(row.report_date),
        meta: numericValue(row.meta).toFixed(2),
        google: numericValue(row.google).toFixed(2),
        tiktok: numericValue(row.tiktok).toFixed(2),
      }))))
      .catch((error: unknown) => setAdsError(error instanceof Error ? error.message : 'Unable to load saved ADS data.'))
  }, [])

  useEffect(() => {
    if (view !== 'cogs') return
    void fetch(getApiUrl('/api/shopify/cogs?dates=1'))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load saved COGS dates')))
      .then((payload: { dates?: string[] }) => setSavedCogsDates(new Set(payload.dates ?? [])))
      .catch(() => undefined)
  }, [view])

  useEffect(() => {
    if (view !== 'ads' || !adsDate) return
    void fetch(getApiUrl(`/api/shopify/cogs?date=${encodeURIComponent(adsDate)}`))
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load COGS total')))
      .then((payload: { rows?: ShopifyCogsRow[] }) => {
        updateAdsCostBreakdown(adsDate, payload.rows ?? [])
      })
      .catch(() => undefined)
  }, [view, adsDate])

  function updateAdsRow(date: string, field: keyof AdsSummaryRow, value: string) {
    setAdsRows((rows) => {
      const exists = rows.some((row) => row.date === date)
      const next = exists ? rows : [...rows, emptyAdsSummary(date)]
      return next.map((row) => row.date === date ? { ...row, [field]: value } : row).sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  async function saveAdsRow(row: AdsSummaryRow) {
    try {
      const response = await fetch(getApiUrl('/api/supplements/ads'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_date: row.date, meta: row.meta, google: row.google, tiktok: row.tiktok }),
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message || `Unable to save ADS data (${response.status}).`)
      setAdsFeedback(`ADS values for ${row.date} were saved.`)
      setAdsError('')
    } catch (error) {
      setAdsError(error instanceof Error ? error.message : 'Unable to save ADS data.')
    }
  }

  function updateAdsCostBreakdown(date: string, rows: ShopifyCogsRow[]) {
    const total = (field: keyof ShopifyCogsRow) => rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0).toFixed(2)
    setAdsRows((currentRows) => {
      const existing = currentRows.find((row) => row.date === date) ?? emptyAdsSummary(date)
      const updated = {
        ...existing,
        cogs: total('subtotal'),
        shipping: total('shipping'),
        fulfillment: total('fulfillment_supliful'),
        processing: rows.reduce((sum, row) => sum + (Number(row.processing_supliful) || 0) + (Number(row.processing_shopify) || 0), 0).toFixed(2),
      }
      return [...currentRows.filter((row) => row.date !== date), updated].sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  async function fetchAdsCosts() {
    setAdsCostsLoading(true); setAdsError(''); setAdsFeedback('')
    const sources = [
      { name: 'Meta', field: 'meta' as const, path: '/api/meta-ads/cost' },
      { name: 'Google', field: 'google' as const, path: '/api/google-ads/cost' },
    ]
    const results = await Promise.all(sources.map(async (source) => {
      const response = await fetch(getApiUrl(`${source.path}?date=${encodeURIComponent(adsDate)}`))
      const payload = await response.json() as { cost?: number; message?: string }
      if (!response.ok) throw new Error(`${source.name}: ${payload.message || `request failed (${response.status})`}`)
      return { name: source.name, field: source.field, value: numericValue(payload.cost).toFixed(2) }
    }).map((request) => request.then((result) => ({ ...result, error: '' })).catch((error: unknown) => ({ name: '', field: null, value: '', error: error instanceof Error ? error.message : 'Ad cost fetch failed.' }))))
    const fetched = results.flatMap((result) => result.name ? [result.name] : [])
    const errors = results.flatMap((result) => result.error ? [result.error] : [])
    if (fetched.length) {
      const existing = adsRows.find((row) => row.date === adsDate) ?? emptyAdsSummary(adsDate)
      const updated = results.reduce((row, result) => result.field ? { ...row, [result.field]: result.value } : row, existing)
      setAdsRows((rows) => [...rows.filter((row) => row.date !== adsDate), updated].sort((a, b) => a.date.localeCompare(b.date)))
      await saveAdsRow(updated)
      setAdsFeedback(`${fetched.join(' and ')} Ads cost for ${adsDate} was fetched and saved to Supabase.`)
    }
    if (errors.length) setAdsError(errors.join(' '))
    setAdsCostsLoading(false)
  }

  function updateCogsRow(id: string, field: keyof ShopifyCogsRow, value: string) {
    setCogsRows((rows) => rows.map((row) => {
      if (row.id !== id) return row
      const numericField = cogsNumericFields.includes(field as typeof cogsNumericFields[number])
      const nullableCostField = field === 'unit_price' || field === 'subtotal'
      const next = { ...row, [field]: numericField ? (nullableCostField && value === '' ? null : Number(value) || 0) : value }
      if (field === 'unit_price' || field === 'qty') {
        next.subtotal = next.unit_price == null ? null : Math.round(next.unit_price * next.qty * 100) / 100
      }
      if (field !== 'total' && cogsNumericFields.includes(field as typeof cogsNumericFields[number])) {
        next.total = Math.round(((next.subtotal ?? 0) + next.shipping + next.fulfillment_supliful + next.processing_supliful + next.processing_shopify) * 100) / 100
      }
      return next
    }))
  }

  async function requestCogs(method: 'GET' | 'POST' | 'PUT') {
    setCogsLoading(true); setCogsError(''); setCogsMessage('')
    try {
      const url = method === 'GET' ? `/api/shopify/cogs?date=${encodeURIComponent(cogsDate)}` : '/api/shopify/cogs'
      const response = await fetch(getApiUrl(url), method === 'GET' ? undefined : {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: cogsDate, ...(method === 'PUT' ? { rows: cogsRows } : {}) }),
      })
      const payload = await response.json() as { rows?: ShopifyCogsRow[]; message?: string }
      if (!response.ok) throw new Error(payload.message || `Unable to ${method === 'POST' ? 'fetch' : 'save'} COGS data (${response.status}).`)
      const rows = payload.rows ?? []
      setCogsRows(rows)
      updateAdsCostBreakdown(cogsDate, rows)
      if (method !== 'GET') setSavedCogsDates((dates) => new Set(dates).add(cogsDate))
      setCogsMessage(method === 'POST' ? `${payload.rows?.length ?? 0} Shopify line items fetched and saved.` : method === 'PUT' ? 'COGS & Fee edits saved.' : (payload.rows?.length ? 'Saved COGS & Fee data loaded.' : 'No saved COGS & Fee data exists for this date.'))
    } catch (error) {
      setCogsError(error instanceof Error ? error.message : 'Unable to process COGS & Fee data.')
    } finally { setCogsLoading(false) }
  }

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
      let payload: { rows?: ShopifySalesRow[]; historicalRows?: ShopifyHistoricalProductRow[]; message?: string } = {}
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
      setSavedShopifyDates((dates) => new Set(dates).add(shopifyDate))
      setShopifyMessage(`${rows.length} sales line item${rows.length === 1 ? '' : 's'} fetched and saved.`)
    } catch (error) {
      setShopifyError(error instanceof Error ? error.message : 'Unable to fetch Shopify sales.')
    } finally {
      setShopifyLoading(false)
    }
  }

  async function viewSavedShopifyReport() {
    setShopifyLoading(true)
    setShopifyError('')
    setShopifyMessage('')
    try {
      const response = await fetch(getApiUrl(`/api/shopify/sales?date=${encodeURIComponent(shopifyDate)}`))
      const payload = await response.json() as { rows?: ShopifySalesRow[]; historicalRows?: ShopifyHistoricalProductRow[]; message?: string }
      if (!response.ok) throw new Error(payload.message || `Unable to view saved Shopify sales (${response.status}).`)
      const rows = payload.rows ?? []
      setShopifyRows(rows)
      setShopifyMessage(rows.length
        ? `${rows.length} saved sales line item${rows.length === 1 ? '' : 's'} loaded.`
        : `Saved snapshot for ${shopifyDate} contains no sales.`)
    } catch (error) {
      setShopifyError(error instanceof Error ? error.message : 'Unable to view saved Shopify sales.')
    } finally {
      setShopifyLoading(false)
    }
  }

  async function requestTotalSales(mode: 'fetch' | 'view') {
    setTotalSalesLoading(true); setTotalSalesError(''); setTotalSalesMessage('')
    try {
      const response = await fetch(getApiUrl(mode === 'fetch' ? '/api/shopify/sales' : `/api/shopify/sales?date=${encodeURIComponent(totalSalesDate)}`), mode === 'fetch' ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: totalSalesDate }),
      } : undefined)
      const payload = await response.json() as { rows?: ShopifySalesRow[]; message?: string }
      if (!response.ok) throw new Error(payload.message || `Unable to ${mode} total sales (${response.status}).`)
      const rows = payload.rows ?? []
      setTotalSalesRows(rows)
      if (mode === 'fetch') setSavedShopifyDates((dates) => new Set(dates).add(totalSalesDate))
      setTotalSalesMessage(rows.length ? `${rows.length} sales line items ${mode === 'fetch' ? 'fetched and saved' : 'loaded'}.` : `No saved Shopify sales exist for ${totalSalesDate}.`)
    } catch (error) {
      setTotalSalesError(error instanceof Error ? error.message : 'Unable to load total sales by order.')
    } finally { setTotalSalesLoading(false) }
  }

  async function updateShopifyHistory() {
    setShopifyHistoryLoading(true)
    setShopifyError('')
    setShopifyMessage('')
    try {
      const throughDate = getToday()
      const response = await fetch(getApiUrl('/api/shopify/sales'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'history', date: throughDate }),
      })
      const payload = await response.json() as { historicalRows?: ShopifyHistoricalProductRow[]; fetchedAt?: string; message?: string }
      if (!response.ok) throw new Error(payload.message || `Unable to update historical Shopify sales (${response.status}).`)
      setShopifyHistoricalRows(payload.historicalRows ?? [])
      setShopifyHistoryUpdatedAt(payload.fetchedAt ?? new Date().toISOString())
      setShopifyMessage(`All Shopify product sales were updated through ${throughDate}.`)
    } catch (error) {
      setShopifyError(error instanceof Error ? error.message : 'Unable to update historical Shopify sales.')
    } finally {
      setShopifyHistoryLoading(false)
    }
  }

  async function fetchDailyOverview() {
    if (!dateInput) return
    const date = dateInput
    setOverviewLoading(true)
    setOverviewError('')
    setOverviewMessage('')

    async function requestJson<T>(path: string, init?: RequestInit) {
      const response = await fetch(getApiUrl(path), init)
      const payload = await response.json().catch(() => ({})) as T & { message?: string }
      if (!response.ok) throw new Error(payload.message || `Request failed (${response.status}).`)
      return payload
    }

    try {
      setReportDate(date)
      setOrdersDate(date)
      setShopifyDate(date)
      setTotalSalesDate(date)
      setAdsDate(date)
      setCogsDate(date)

      const postDate = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) }
      const [salesResult, ordersResult, cogsResult, metaResult, googleResult, savedAdsResult] = await Promise.allSettled([
        requestJson<{ rows?: ShopifySalesRow[] }>('/api/shopify/sales', postDate),
        requestJson<{ rows?: ShopifyOrderRow[] }>('/api/shopify/orders', postDate),
        requestJson<{ rows?: ShopifyCogsRow[]; warnings?: string[] }>('/api/shopify/cogs', postDate),
        requestJson<{ cost?: number }>(`/api/meta-ads/cost?date=${encodeURIComponent(date)}`),
        requestJson<{ cost?: number }>(`/api/google-ads/cost?date=${encodeURIComponent(date)}`),
        requestJson<{ rows?: SavedAdsRow[] }>(`/api/supplements/ads?date=${encodeURIComponent(date)}`),
      ])

      const sales = salesResult.status === 'fulfilled' ? salesResult.value.rows ?? [] : []
      const orders = ordersResult.status === 'fulfilled' ? ordersResult.value.rows ?? [] : []
      const costs = cogsResult.status === 'fulfilled' ? cogsResult.value.rows ?? [] : []
      const savedAds = savedAdsResult.status === 'fulfilled' ? savedAdsResult.value.rows?.[0] : undefined
      const previousAds = savedAds ? {
        ...emptyAdsSummary(date),
        meta: numericValue(savedAds.meta).toFixed(2),
        google: numericValue(savedAds.google).toFixed(2),
        tiktok: numericValue(savedAds.tiktok).toFixed(2),
      } : adsRows.find((row) => row.date === date) ?? emptyAdsSummary(date)
      const nextAds: AdsSummaryRow = {
        ...previousAds,
        meta: metaResult.status === 'fulfilled' ? numericValue(metaResult.value.cost).toFixed(2) : previousAds.meta,
        google: googleResult.status === 'fulfilled' ? numericValue(googleResult.value.cost).toFixed(2) : previousAds.google,
        cogs: costs.reduce((sum, row) => sum + numericValue(row.subtotal), 0).toFixed(2),
        shipping: costs.reduce((sum, row) => sum + numericValue(row.shipping), 0).toFixed(2),
        fulfillment: costs.reduce((sum, row) => sum + numericValue(row.fulfillment_supliful), 0).toFixed(2),
        processing: costs.reduce((sum, row) => sum + numericValue(row.processing_supliful) + numericValue(row.processing_shopify), 0).toFixed(2),
      }
      const nextAdsRows = [...adsRows.filter((row) => row.date !== date), nextAds].sort((a, b) => a.date.localeCompare(b.date))

      setShopifyRows(sales)
      setTotalSalesRows(sales)
      setOrderRows(orders)
      setCogsRows(costs)
      setAdsRows(nextAdsRows)
      await requestJson('/api/supplements/ads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_date: date, meta: nextAds.meta, google: nextAds.google, tiktok: nextAds.tiktok }),
      })
      if (salesResult.status === 'fulfilled') setSavedShopifyDates((dates) => new Set(dates).add(date))
      if (ordersResult.status === 'fulfilled') setSavedOrderDates((dates) => new Set(dates).add(date))
      if (cogsResult.status === 'fulfilled') setSavedCogsDates((dates) => new Set(dates).add(date))

      setOverview({ daily: summarizeFinance(sales, costs, nextAds), monthly: emptyFinanceTotals() })

      const failures = [salesResult, ordersResult, cogsResult, metaResult, googleResult, savedAdsResult]
        .flatMap((result) => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'A source failed to refresh.'] : [])
      if (cogsResult.status === 'fulfilled') failures.push(...(cogsResult.value.warnings ?? []))
      if (failures.length) setOverviewError(`Some sources could not be refreshed: ${failures.join(' ')}`)
      setOverviewMessage(`All available report sections were refreshed for ${date}.`)
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : 'Unable to refresh the finance report.')
    } finally {
      setOverviewLoading(false)
    }
  }

  function formatShopifyAmount(value: number | null) {
    return value == null ? '' : value.toFixed(2)
  }

  const daily = overview?.daily
  const dailyExpenseValues = daily ? [
    daily.meta, daily.tiktok, daily.google, daily.shipping, daily.fulfillment,
    daily.processingSupliful, daily.processingShopify, daily.cogs,
  ] : []

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
          <form onSubmit={(event) => { event.preventDefault(); void fetchDailyOverview() }}>
            <label htmlFor="supplements-date">Report date</label>
            <input id="supplements-date" type="date" max={getToday()} value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
            <button type="submit" disabled={!dateInput || overviewLoading}>{overviewLoading ? 'Fetching…' : 'Fetch all'}</button>
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
                <tr><th scope="row">Shopify Sales Daily</th><td>{daily ? daily.qty.toLocaleString('en-US') : <EmptyAmount />}</td><td>{daily ? moneyAmount(daily.sales) : <EmptyAmount />}</td></tr>
                <tr className="supplements-total"><th scope="row">Gross Profit Daily</th><td><EmptyAmount /></td><td>{daily ? moneyAmount(daily.sales) : <EmptyAmount />}</td></tr>
                {dailyExpenses.map((label, index) => <tr key={label}><th scope="row">{label}</th><td /><td>{daily ? moneyAmount(dailyExpenseValues[index]) : <EmptyAmount />}</td></tr>)}
                <tr className="supplements-total"><th scope="row">Total Spend Daily</th><td /><td>{daily ? moneyAmount(totalSpend(daily)) : <EmptyAmount />}</td></tr>
                <tr className="supplements-net"><th scope="row">Net Profit Daily</th><td><EmptyAmount /></td><td>{daily ? moneyAmount(daily.sales - totalSpend(daily)) : <EmptyAmount />}</td></tr>
                <tr className="supplements-month"><th scope="row">Gross Profit Monthly</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                <tr><th scope="row">Spend Monthly <small>(ads, GMV Max &amp; fees)</small></th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
                <tr className="supplements-net"><th scope="row">Net Profit Monthly</th><td><EmptyAmount /></td><td><EmptyAmount /></td></tr>
              </tbody>
            </table>
          </div>
          {overviewError ? <p className="supplements-orders-feedback error" role="alert">{overviewError}</p> : null}
          {overviewMessage ? <p className="supplements-orders-feedback success" role="status">{overviewMessage}</p> : null}
          <p className="supplements-note"><span /> Fetch all refreshes every sidebar section for this date. TikTok uses the value saved in the ADS sheet.</p>
        </div></> : view === 'ads' ? <section className="supplements-content" aria-labelledby="supplements-ads-title">
          <div className="supplements-table-heading">
            <div><span>Advertising spend</span><h2 id="supplements-ads-title">ADS</h2></div>
          </div>
          <form className="supplements-ads-controls" onSubmit={(event) => { event.preventDefault(); void fetchAdsCosts() }}>
            <label>Report date<input type="date" value={adsDate} onChange={(event) => setAdsDate(event.target.value)} /></label>
            <button type="submit" disabled={adsCostsLoading || !adsDate}>{adsCostsLoading ? 'Fetching…' : 'Fetch ad costs'}</button>
          </form>
          {adsError ? <p className="supplements-orders-feedback error" role="alert">{adsError}</p> : null}
          {adsFeedback ? <p className="supplements-orders-feedback success" role="status">{adsFeedback}</p> : null}
          <div className="supplements-table-wrap">
            <table className="supplements-ads-sheet supplements-ads-summary-table">
              <caption>Advertising &amp; Cost Sheet</caption>
              <thead><tr>{adsSummaryHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
              <tbody>{adsRows.length ? adsRows.map((row) => <tr key={row.date}>
                <th scope="row">{new Date(`${row.date}T12:00:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</th>
                {(['meta', 'google', 'tiktok', 'cogs', 'shipping', 'fulfillment', 'processing'] as const).map((field) => <td key={field}><input aria-label={`${adsSummaryHeaders[(['meta', 'google', 'tiktok', 'cogs', 'shipping', 'fulfillment', 'processing'] as const).indexOf(field) + 1]} ${row.date}`} inputMode="decimal" value={row[field]} onChange={(event) => updateAdsRow(row.date, field, event.target.value)} onBlur={() => void saveAdsRow(row)} placeholder="0.00" /></td>)}
              </tr>) : <tr><td className="supplements-ads-empty" colSpan={adsSummaryHeaders.length}>Select a date and fetch Google cost to begin the report.</td></tr>}</tbody>
            </table>
          </div>
        </section> : view === 'cogs' ? <section className="supplements-content" aria-labelledby="supplements-cogs-title">
          <div className="supplements-table-heading">
            <div><span>Shopify order costs</span><h2 id="supplements-cogs-title">COGS &amp; Fee</h2></div>
          </div>
          <form className="supplements-orders-filter" onSubmit={(event) => { event.preventDefault(); void requestCogs('POST') }}>
            <div className="supplements-orders-date-control"><span>Order date</span>
              <OrderCalendar selected={cogsDate} savedDates={savedCogsDates} onSelect={(date) => { setCogsDate(date); setCogsRows([]); setCogsMessage(''); setCogsError('') }} />
            </div>
            <button type="submit" disabled={cogsLoading}>{cogsLoading ? 'Working…' : 'Fetch Shopify'}</button>
            <button className="view" type="button" onClick={() => void requestCogs('GET')} disabled={cogsLoading}>View</button>
            <button className="view" type="button" onClick={() => void requestCogs('PUT')} disabled={cogsLoading || !cogsRows.length}>Save edits</button>
          </form>
          {cogsError ? <p className="supplements-orders-feedback error" role="alert">{cogsError}</p> : null}
          {cogsMessage ? <p className="supplements-orders-feedback success" role="status">{cogsMessage}</p> : null}
          <div className="supplements-table-wrap">
            <table className="supplements-ads-sheet supplements-cogs-table">
              <caption>COGS &amp; Fee by Order</caption>
              <thead><tr>{cogsHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
              <tbody>{cogsRows.length ? cogsRows.map((row) => <tr key={row.id}>
                <td><input aria-label="Date" type="date" value={row.date} onChange={(event) => updateCogsRow(row.id, 'date', event.target.value)} /></td>
                <td><input aria-label="Order" value={row.order} onChange={(event) => updateCogsRow(row.id, 'order', event.target.value)} /></td>
                <td><input aria-label="Product" value={row.product} onChange={(event) => updateCogsRow(row.id, 'product', event.target.value)} /></td>
                {cogsNumericFields.map((field) => <td key={field}><input aria-label={cogsHeaders[cogsNumericFields.indexOf(field) + 3]} type="number" inputMode="decimal" step={field === 'qty' ? '1' : '0.01'} value={row[field] ?? ''} readOnly={field === 'subtotal'} onChange={(event) => updateCogsRow(row.id, field, event.target.value)} /></td>)}
              </tr>) : <tr><td className="supplements-ads-empty" colSpan={cogsHeaders.length}>Choose a date and fetch Shopify orders, or view a saved date.</td></tr>}</tbody>
            </table>
          </div>
          <p className="supplements-note"><span /> Click any cell to edit it, then select Save edits. Fee changes recalculate Total automatically.</p>
        </section> : view === 'shopify' ? <section className="supplements-content" aria-labelledby="supplements-shopify-title">
          <div className="supplements-table-heading">
            <div><span>Shopify export</span><h2 id="supplements-shopify-title">Shopify</h2></div>
          </div>
          <div className="supplements-shopify-history-actions">
            <div><strong>All-time product sales</strong><small>{shopifyHistoryUpdatedAt ? `Last updated ${new Date(shopifyHistoryUpdatedAt).toLocaleString()}` : 'No saved update yet'}</small></div>
            <button type="button" onClick={() => void updateShopifyHistory()} disabled={shopifyHistoryLoading}>{shopifyHistoryLoading ? 'Updating…' : 'Update'}</button>
          </div>
          {shopifyError ? <p className="supplements-orders-feedback error" role="alert">{shopifyError}</p> : null}
          {shopifyMessage ? <p className="supplements-orders-feedback success" role="status">{shopifyMessage}</p> : null}
          <div className="supplements-table-wrap supplements-shopify-history-wrap">
            <table className="supplements-shopify-history-table">
              <caption>Dharma Shopify Sales</caption>
              <thead><tr><th scope="col">Product</th><th scope="col">Qty.</th><th scope="col">Sales Amount</th></tr></thead>
              <tbody>{shopifyHistoricalRows.length ? shopifyHistoricalRows.map((row) => <tr key={row.product}>
                <td>{row.product}</td><td>{row.qty}</td><td>{row.sales_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
              </tr>) : <tr><td className="supplements-ads-empty" colSpan={3}>Select Update to import all historical Shopify product sales.</td></tr>}</tbody>
            </table>
          </div>
          <div className="supplements-table-heading supplements-shopify-detail-heading"><div><span>Selected date</span><h2>Daily Shopify detail</h2></div></div>
          <form className="supplements-orders-filter" onSubmit={(event) => { event.preventDefault(); void fetchShopifyReport() }}>
            <div className="supplements-orders-date-control"><span>Report date</span>
              <OrderCalendar selected={shopifyDate} savedDates={savedShopifyDates} onSelect={(date) => {
                setShopifyDate(date)
                setShopifyRows([])
                setShopifyMessage('')
                setShopifyError('')
              }} />
            </div>
            <button type="submit" disabled={shopifyLoading}>{shopifyLoading ? 'Working…' : 'Fetch Shopify'}</button>
            <button className="view" type="button" onClick={() => void viewSavedShopifyReport()} disabled={shopifyLoading}>View</button>
          </form>
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
        </section> : view === 'sales' ? <section className="supplements-content" aria-labelledby="supplements-total-sales-title">
          <div className="supplements-table-heading">
            <div><span>Shopify orders</span><h2 id="supplements-total-sales-title">Total sales by order</h2></div>
          </div>
          <form className="supplements-orders-filter" onSubmit={(event) => { event.preventDefault(); void requestTotalSales('fetch') }}>
            <div className="supplements-orders-date-control"><span>Order date</span>
              <OrderCalendar selected={totalSalesDate} savedDates={savedShopifyDates} onSelect={(date) => { setTotalSalesDate(date); setTotalSalesRows([]); setTotalSalesMessage(''); setTotalSalesError('') }} />
            </div>
            <button type="submit" disabled={totalSalesLoading}>{totalSalesLoading ? 'Working…' : 'Fetch Shopify'}</button>
            <button className="view" type="button" onClick={() => void requestTotalSales('view')} disabled={totalSalesLoading}>View</button>
          </form>
          {totalSalesError ? <p className="supplements-orders-feedback error" role="alert">{totalSalesError}</p> : null}
          {totalSalesMessage ? <p className="supplements-orders-feedback success" role="status">{totalSalesMessage}</p> : null}
          <div className="supplements-table-wrap">
            <table className="supplements-table supplements-orders-table supplements-total-sales-table">
              <thead><tr>{totalSalesHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
              <tbody>{totalSalesRows.length ? totalSalesRows.map((row) => <tr key={row.id}>
                <td>{row.day ? new Date(`${row.day}T12:00:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : ''}</td>
                <td>{row.sale_id}</td><td>{row.order_name}</td><td title={row.product_title}>{row.product_title}</td>
                <td>{formatShopifyAmount(row.line_gross_sales ?? 0)}</td><td>{formatShopifyAmount(row.line_discounts ?? 0)}</td>
                <td>{formatShopifyAmount(row.line_returns ?? 0)}</td><td>{formatShopifyAmount(row.line_net_sales ?? 0)}</td>
                <td>{formatShopifyAmount(row.line_shipping_charges ?? 0)}</td><td>{formatShopifyAmount(row.line_return_fees ?? 0)}</td>
                <td>{formatShopifyAmount(row.line_taxes ?? 0)}</td><td>{formatShopifyAmount(row.line_total_sales ?? 0)}</td>
              </tr>) : <tr className="supplements-placeholder-row"><td colSpan={totalSalesHeaders.length}>Choose a date and fetch that day's Shopify sales.</td></tr>}</tbody>
            </table>
          </div>
          <p className="supplements-note"><span /> Values come from Shopify orders and refunds. Fetch replaces the saved snapshot for the selected date.</p>
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
