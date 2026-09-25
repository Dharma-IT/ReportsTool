const productRevenue = [
  { name: 'Weight Loss Injections', value: 22849, share: 63.9, color: '#1e754c' },
  { name: 'Slim Boost', value: 1157, share: 3.2, color: '#55c995' },
  { name: 'Nutritional Plans', value: 1643, share: 4.6, color: '#9bd6bd' },
  { name: 'NAD+', value: 2759, share: 7.7, color: '#2bf1a0' },
  { name: 'Peptides', value: 7334, share: 20.5, color: '#a3bf9d' },
]

const weeklySales = [
  { name: 'Alejandro', lastWeek: 11200, twoWeeksAgo: 4800, average: 8000, highest: 11200, lastSales: 8, priorSales: 3 },
  { name: 'Andrés', lastWeek: 12400, twoWeeksAgo: 11200, average: 11800, highest: 15800, lastSales: 5, priorSales: 7 },
  { name: 'María C.', lastWeek: 7400, twoWeeksAgo: 11600, average: 9500, highest: 19500, lastSales: 7, priorSales: 4 },
  { name: 'Meribet', lastWeek: 11100, twoWeeksAgo: 17100, average: 14100, highest: 32700, lastSales: 5, priorSales: 5 },
]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
type WeeklyPeriod = { fromDate: string; toDate: string; revenue: number; refunds: number; dealCount: number; bySeller: Record<string, number>; refundsBySeller: Record<string, number>; products: Record<string, WeeklyProductTotals> }
type WeeklyProductTotals = { revenue: number; units: number; bySeller: Record<string, { revenue: number; units: number }> }
type WeeklyReport = { timezone: string; lastWeek: WeeklyPeriod; twoWeeksAgo: WeeklyPeriod; insights: Array<{ kind: string; title: string; detail: string }> }
type WeeklyTeam = 'sales' | 'cs'

const csWeeklyNames = ['arles martinez', 'brayam zuluaga', 'brayan zuluaga', 'edmilson velasquez', 'edmilson morales', 'alice f', 'aline strelow', 'ailene nuevas']
const excludedWeeklyNames = ['denis reis', 'paula alfonso', 'maria sandoval']
const isCsWeeklySeller = (name: string) => csWeeklyNames.includes(name.trim().toLowerCase())
const isExcludedWeeklySeller = (name: string) => excludedWeeklyNames.includes(name.trim().toLowerCase())

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
function weeklyApiUrl(path: string) { return ['localhost', '127.0.0.1'].includes(window.location.hostname) ? path : `${configuredApiBaseUrl}${path}` }

type ProductComparison = {
  title: string
  subtitle: string
  direction: 'up' | 'down' | 'flat'
  summary: string
  detail?: string
  maximum: number
  agents: Array<{ name: string; last: number; prior: number; lastSales?: number; priorSales?: number }>
}

const productComparisons: ProductComparison[] = [
  { title: 'Slim Boost', subtitle: 'Compared to Injections', direction: 'flat', summary: 'Slim Boost revenue stayed equal by $801 compared to two weeks ago', detail: 'Last week we sold 9 slim boosts, compared to 9 units two weeks ago.', maximum: 100, agents: [
    { name: 'Andrés', last: 50, prior: 38, lastSales: 4, priorSales: 3 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'María C.', last: 40, prior: 80, lastSales: 2, priorSales: 4 }, { name: 'Meribet', last: 60, prior: 40, lastSales: 3, priorSales: 2 }, { name: 'Avrg', last: 32, prior: 32 },
  ] },
  { title: 'Nutr. Plan', subtitle: 'Compared to Injections', direction: 'down', summary: 'Nutritional Plan revenue decreased by $551 compared to two weeks ago', detail: 'We sold 11 nutritional plans, compared to 15 units two weeks ago.', maximum: 140, agents: [
    { name: 'Andrés', last: 0, prior: 40, lastSales: 0, priorSales: 4 }, { name: 'Alejandro', last: 0, prior: 60, lastSales: 0, priorSales: 3 }, { name: 'María C.', last: 70, prior: 125, lastSales: 5, priorSales: 2 }, { name: 'Meribet', last: 90, prior: 78, lastSales: 6, priorSales: 5 }, { name: 'Avrg', last: 70, prior: 81 },
  ] },
  { title: 'NAD+', subtitle: 'Sales per Seller', direction: 'down', summary: 'NAD+ revenue increased by $282 compared to two weeks ago', detail: 'Last week we sold 3 NAD+ injections, compared to 5 units two weeks ago.', maximum: 70, agents: [
    { name: 'Andrés', last: 33, prior: 50, lastSales: 1, priorSales: 4 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'María C.', last: 0, prior: 0 }, { name: 'Meribet', last: 66, prior: 20, lastSales: 2, priorSales: 1 }, { name: 'Avrg', last: 14, prior: 14 },
  ] },
  { title: 'Sermorelin', subtitle: 'Compared to Injections', direction: 'up', summary: 'Sermorelin revenue increased by $2,247 compared to two weeks ago', detail: 'Last week we sold 17 Sermorelin, compared to 9 units two weeks ago.', maximum: 70, agents: [
    { name: 'Andrés', last: 0, prior: 63, priorSales: 5 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'María C.', last: 40, prior: 40, lastSales: 8, priorSales: 2 }, { name: 'Meribet', last: 50, prior: 40, lastSales: 9, priorSales: 2 }, { name: 'Avrg', last: 29, prior: 29 },
  ] },
  { title: 'GHK-Cu Troches', subtitle: 'Compared to Injections', direction: 'down', summary: 'No GHK revenue for the past two weeks.', maximum: 100, agents: [
    { name: 'Andrés', last: 0, prior: 0 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'Leonardo G.', last: 0, prior: 0 }, { name: 'María C.', last: 0, prior: 0 }, { name: 'Meribet', last: 0, prior: 0 }, { name: 'Avrg', last: 0, prior: 0 },
  ] },
  { title: 'Glutathione', subtitle: 'Compared to Injections', direction: 'flat', summary: 'Just one Glutathione revenue for the past two weeks.', maximum: 100, agents: [
    { name: 'Andrés', last: 0, prior: 0 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'María C.', last: 0, prior: 0 }, { name: 'Meribet', last: 100, prior: 0, lastSales: 1 }, { name: 'Avrg', last: 0, prior: 0 },
  ] },
]

function ProductComparisonCard({ product }: { product: ProductComparison }) {
  const ticks = Array.from({ length: Math.floor(product.maximum / 20) + 1 }, (_, index) => index * 20)
  return <section className="weekly-product-card" aria-label={`${product.title} weekly comparison`}>
    <aside className="weekly-product-copy">
      <div><h2>{product.title}</h2><strong>{product.subtitle}</strong></div>
      <div className="weekly-product-summary"><span className={product.direction} aria-hidden="true">{product.direction === 'up' ? '↗' : product.direction === 'down' ? '↘' : '→'}</span><strong>{product.summary}</strong>{product.detail ? <p>{product.detail}</p> : null}</div>
    </aside>
    <div className="weekly-product-chart-area">
      <div className="weekly-chart-legend"><span><i className="last" />Last week</span><span><i className="average" />Two weeks ago</span></div>
      <div className="weekly-product-chart">
        <div className="weekly-product-y-axis">{ticks.map((tick) => <span key={tick} style={{ bottom: `${(tick / product.maximum) * 100}%` }}>{tick}%</span>)}</div>
        <div className="weekly-product-plot">
          <div className="weekly-grid-lines">{ticks.map((tick) => <i key={tick} style={{ bottom: `${(tick / product.maximum) * 100}%` }} />)}</div>
          {product.agents.map((agent) => <div className="weekly-product-group" key={agent.name}>
            <div className="weekly-product-bars">
              <span className="last" style={{ height: `${(agent.last / product.maximum) * 100}%` }}>{agent.last ? <em>{agent.last.toFixed(2)}%</em> : null}{agent.lastSales !== undefined ? <><b>{agent.lastSales}</b><small>Sales</small></> : null}</span>
              <span className="average" style={{ height: `${(agent.prior / product.maximum) * 100}%` }}>{agent.prior ? <em>{agent.prior.toFixed(2)}%</em> : null}{agent.priorSales !== undefined ? <><b>{agent.priorSales}</b><small>Sales</small></> : null}</span>
            </div>
            <strong>{agent.name}</strong>
          </div>)}
        </div>
      </div>
    </div>
  </section>
}

function Weekly() {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [error, setError] = useState('')
  const [activeTeam, setActiveTeam] = useState<WeeklyTeam>('sales')
  useEffect(() => {
    const controller = new AbortController()
    fetch(weeklyApiUrl('/api/weekly-report'), { signal: controller.signal }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to load the weekly report.')
      return payload as WeeklyReport
    }).then(setReport).catch((loadError: unknown) => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the weekly report.')
    })
    return () => controller.abort()
  }, [])

  const activeReport = useMemo(() => {
    if (!report) return null
    const filterPeriod = (period: WeeklyPeriod): WeeklyPeriod => {
      const keep = (name: string) => !isExcludedWeeklySeller(name) && (activeTeam === 'cs' ? isCsWeeklySeller(name) : !isCsWeeklySeller(name))
      const bySeller = Object.fromEntries(Object.entries(period.bySeller).filter(([name]) => keep(name)))
      const refundsBySeller = Object.fromEntries(Object.entries(period.refundsBySeller).filter(([name]) => keep(name)))
      const products = Object.fromEntries(Object.entries(period.products).map(([name, product]) => {
        const productSellers = Object.fromEntries(Object.entries(product.bySeller).filter(([seller]) => keep(seller)))
        return [name, { revenue: Object.values(productSellers).reduce((sum, row) => sum + row.revenue, 0), units: Object.values(productSellers).reduce((sum, row) => sum + row.units, 0), bySeller: productSellers }]
      }))
      return { ...period, revenue: Object.values(bySeller).reduce((sum, value) => sum + value, 0), refunds: Object.values(refundsBySeller).reduce((sum, value) => sum + value, 0), bySeller, refundsBySeller, products }
    }
    const lastWeek = filterPeriod(report.lastWeek)
    const twoWeeksAgo = filterPeriod(report.twoWeeksAgo)
    const revenueDelta = lastWeek.revenue - twoWeeksAgo.revenue
    const lastUnits = Object.values(lastWeek.products).reduce((sum, product) => sum + product.units, 0)
    const priorUnits = Object.values(twoWeeksAgo.products).reduce((sum, product) => sum + product.units, 0)
    const topSeller = Object.entries(lastWeek.bySeller).sort((a, b) => b[1] - a[1])[0]
    return { ...report, lastWeek, twoWeeksAgo, insights: [
      { kind: revenueDelta >= 0 ? 'up' : 'down', title: `Revenue ${revenueDelta >= 0 ? 'increased' : 'decreased'} by ${money.format(Math.abs(revenueDelta))} last week`, detail: `Revenue was ${money.format(lastWeek.revenue)} versus ${money.format(twoWeeksAgo.revenue)} two weeks ago.` },
      { kind: lastUnits >= priorUnits ? 'up' : 'down', title: `Product units ${lastUnits >= priorUnits ? 'increased' : 'decreased'} by ${Math.abs(lastUnits - priorUnits)}`, detail: `${lastUnits} units were sold last week versus ${priorUnits} two weeks ago.` },
      { kind: 'seller', title: topSeller ? `${topSeller[0]} led last week's revenue` : 'No seller revenue last week', detail: topSeller ? `${money.format(topSeller[1])} in paid HubSpot deals.` : 'No paid HubSpot deals were found for this team.' },
    ] }
  }, [report, activeTeam])

  const revenueProducts = useMemo(() => {
    if (!activeReport) return productRevenue
    const product = (name: string) => activeReport.lastWeek.products[name] ?? { revenue: 0, units: 0, bySeller: {} }
    const peptideNames = ['Peptides', 'Sermorelin', 'GHK-Cu Troches', 'Glutathione']
    const rows = [
      { name: 'Weight Loss Injections', value: product('Weight Loss Injections').revenue, color: '#1e754c' },
      { name: 'Slim Boost', value: product('Slim Boost').revenue, color: '#55c995' },
      { name: 'Nutritional Plans', value: product('Nutritional Plans').revenue, color: '#9bd6bd' },
      { name: 'NAD+', value: product('NAD+').revenue, color: '#2bf1a0' },
      { name: 'Peptides', value: peptideNames.reduce((sum, name) => sum + product(name).revenue, 0), color: '#a3bf9d' },
    ]
    const total = rows.reduce((sum, row) => sum + row.value, 0)
    return rows.map((row) => ({ ...row, share: total ? (row.value / total) * 100 : 0 }))
  }, [activeReport])
  const sellerSales = useMemo(() => {
    if (!activeReport) return weeklySales
    const names = [...new Set([...Object.keys(activeReport.lastWeek.bySeller), ...Object.keys(activeReport.twoWeeksAgo.bySeller)])].sort((a, b) => (activeReport.lastWeek.bySeller[b] ?? 0) - (activeReport.lastWeek.bySeller[a] ?? 0)).slice(0, 8)
    return names.map((name) => { const lastWeek = activeReport.lastWeek.bySeller[name] ?? 0; const twoWeeksAgo = activeReport.twoWeeksAgo.bySeller[name] ?? 0; return { name, lastWeek, twoWeeksAgo, average: (lastWeek + twoWeeksAgo) / 2, highest: Math.max(lastWeek, twoWeeksAgo), lastSales: 0, priorSales: 0 } })
  }, [activeReport])
  const liveChartMaximum = Math.max(1000, Math.ceil(Math.max(...sellerSales.flatMap((seller) => [seller.lastWeek, seller.twoWeeksAgo, seller.highest]), 0) / 5000) * 5000)
  const comparisonProducts = useMemo(() => {
    if (!activeReport) return productComparisons
    return ['Slim Boost', 'Nutritional Plans', 'NAD+', 'Sermorelin', 'GHK-Cu Troches', 'Glutathione'].map((title): ProductComparison => {
      const last = activeReport.lastWeek.products[title] ?? { revenue: 0, units: 0, bySeller: {} }
      const prior = activeReport.twoWeeksAgo.products[title] ?? { revenue: 0, units: 0, bySeller: {} }
      const sellers = [...new Set([...Object.keys(last.bySeller), ...Object.keys(prior.bySeller)])].sort((a, b) => (last.bySeller[b]?.units ?? 0) - (last.bySeller[a]?.units ?? 0)).slice(0, 7)
      const maxUnits = Math.max(last.units, prior.units, 1)
      const delta = last.revenue - prior.revenue
      return { title, subtitle: 'Sales per seller', direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', summary: `${title} revenue ${delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stayed equal'} by ${money.format(Math.abs(delta))} compared to two weeks ago`, detail: `Last week we sold ${last.units} units, compared to ${prior.units} units two weeks ago.`, maximum: 100, agents: sellers.length ? sellers.map((name) => ({ name, last: (last.bySeller[name]?.units ?? 0) / maxUnits * 100, prior: (prior.bySeller[name]?.units ?? 0) / maxUnits * 100, lastSales: last.bySeller[name]?.units ?? 0, priorSales: prior.bySeller[name]?.units ?? 0 })) : [{ name: 'No sales', last: 0, prior: 0 }] }
    })
  }, [activeReport])
  const refundSellers = useMemo(() => {
    if (!activeReport) return [{ name: 'Loading', last: 0, prior: 0 }]
    const names = [...new Set([...Object.keys(activeReport.lastWeek.refundsBySeller), ...Object.keys(activeReport.twoWeeksAgo.refundsBySeller)])]
    const rows = names.map((name) => ({ name, last: activeReport.lastWeek.refundsBySeller[name] ?? 0, prior: activeReport.twoWeeksAgo.refundsBySeller[name] ?? 0 })).filter((row) => row.last || row.prior).sort((a, b) => Math.max(b.last, b.prior) - Math.max(a.last, a.prior))
    return rows.length ? rows : [{ name: 'No refunds', last: 0, prior: 0 }]
  }, [activeReport])
  const refundMaximum = Math.max(100, ...refundSellers.flatMap((seller) => [seller.last, seller.prior]))
  const donut = `conic-gradient(${revenueProducts.map((item, index) => {
    const start = revenueProducts.slice(0, index).reduce((sum, current) => sum + current.share, 0)
    return `${item.color} ${start}% ${start + item.share}%`
  }).join(',')})`

  return (
    <main className="dashboard-shell weekly-page weekly-team-layout">
      <aside className="weekly-team-sidebar" aria-label="Weekly report teams">
        <span>Teams</span>
        <button type="button" className={activeTeam === 'sales' ? 'active' : ''} onClick={() => setActiveTeam('sales')}><b>SL</b><span>Sales<small>Sales team report</small></span></button>
        <button type="button" className={activeTeam === 'cs' ? 'active' : ''} onClick={() => setActiveTeam('cs')}><b>CS</b><span>Customer Service<small>CS team report</small></span></button>
      </aside>
      <div className="weekly-content">
      <header className="weekly-heading">
          <div><p className="eyebrow">Weekly {activeTeam === 'sales' ? 'sales' : 'customer service'} report</p><h1>{activeTeam === 'sales' ? 'Sales' : 'Customer Service'} performance</h1><p>{activeReport ? `${activeReport.lastWeek.fromDate} through ${activeReport.lastWeek.toDate} · Eastern Time` : 'Loading the latest completed HubSpot week…'}</p></div>
        <span>HubSpot {activeTeam === 'sales' ? 'sales' : 'CS'} overview</span>
      </header>

      <section className="weekly-total-revenue" aria-label="Total revenue this week">
        <div><span>Total revenue this week</span><strong>{activeReport ? money.format(activeReport.lastWeek.revenue) : 'Loading…'}</strong><small>{activeTeam === 'sales' ? 'Sales team' : 'Customer Service team'} · Paid HubSpot deals</small></div>
        <div className="weekly-total-comparison"><span>Two weeks ago</span><strong>{activeReport ? money.format(activeReport.twoWeeksAgo.revenue) : '—'}</strong>{activeReport ? <small className={activeReport.lastWeek.revenue >= activeReport.twoWeeksAgo.revenue ? 'positive' : 'negative'}>{activeReport.lastWeek.revenue >= activeReport.twoWeeksAgo.revenue ? '↗' : '↘'} {money.format(Math.abs(activeReport.lastWeek.revenue - activeReport.twoWeeksAgo.revenue))}</small> : null}</div>
      </section>

      <section className="weekly-major-points" aria-labelledby="weekly-major-points-title">
        <h2 id="weekly-major-points-title">Major Points</h2>
        <div className="weekly-insight-grid">
          {(activeReport?.insights ?? [
            { kind: 'down', title: 'Loading weekly revenue insight…', detail: 'Comparing the latest two completed weeks in HubSpot.' },
            { kind: 'up', title: 'Loading product performance…', detail: 'Calculating unit changes from associated line items.' },
            { kind: 'seller', title: 'Loading seller performance…', detail: 'Finding the leading paid-deal owner.' },
          ]).map((insight) => <article key={insight.title}>
            <div className="weekly-insight-icon" aria-hidden="true"><span className="insight-bars"><i /><i /><i /></span></div>
            <strong>{insight.title}</strong><p>{insight.detail}</p>
          </article>)}
        </div>
      </section>

      <section className="weekly-revenue-card" aria-labelledby="weekly-revenue-title">
        <div className="weekly-revenue-intro">
          <div><h2 id="weekly-revenue-title">Sales<br />Revenue</h2><strong>By product</strong></div>
          <p>Visualize where our revenue comes from and the percentage of each part.</p>
        </div>
        <div className="weekly-donut-area">
          <div className="weekly-donut-wrap">
            <div className="weekly-donut" style={{ background: donut }} role="img" aria-label="Product revenue distribution" />
            {revenueProducts.map((item) => <span className={`weekly-donut-label weekly-donut-label-${item.name.toLowerCase().replace(/[^a-z]+/g, '-')}`} key={item.name}>{item.name}<b>{item.share.toFixed(1)}%</b></span>)}
          </div>
          <div className="weekly-product-legend">
            {revenueProducts.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}: <b>{money.format(item.value)}</b></span></div>)}
          </div>
        </div>
      </section>

      <section className="weekly-profit-card" aria-labelledby="weekly-profit-title">
        <aside className="weekly-profit-copy">
          <div><h2 id="weekly-profit-title">Profit</h2><strong>Weekly sales growth</strong></div>
          <div className="weekly-growth-note"><span aria-hidden="true">↗</span><strong>We increased in revenue<br />by $7,330 last week</strong><p>We reached $44,901 in revenue last week, compared to $37,571 two weeks ago.</p></div>
        </aside>
        <div className="weekly-chart-area">
          <div className="weekly-chart-legend"><span><i className="last" />Last week</span><span><i className="prior" />Two weeks ago</span><span><i className="average" />Average</span><span><i className="highest" />Highest</span></div>
          <div className="weekly-chart">
            <div className="weekly-y-axis">{Array.from({ length: 8 }, (_, index) => Math.round(liveChartMaximum * (7 - index) / 7)).map((tick) => <span key={tick} style={{ bottom: `${(tick / liveChartMaximum) * 100}%` }}>{money.format(tick)}</span>)}</div>
            <div className="weekly-chart-plot">
              <div className="weekly-grid-lines">{Array.from({ length: 8 }, (_, index) => index).map((tick) => <i key={tick} style={{ bottom: `${(tick / 7) * 100}%` }} />)}</div>
              {sellerSales.map((agent) => <div className="weekly-bar-group" key={agent.name}>
                <div className="weekly-bars">
                  <span className="last" style={{ height: `${(agent.lastWeek / liveChartMaximum) * 100}%` }} />
                  <span className="prior" style={{ height: `${(agent.twoWeeksAgo / liveChartMaximum) * 100}%` }} />
                  <span className="average" style={{ height: `${(agent.average / liveChartMaximum) * 100}%` }} />
                  <span className="highest" style={{ height: `${(agent.highest / liveChartMaximum) * 100}%` }} />
                </div>
                <strong>{agent.name}</strong>
              </div>)}
            </div>
          </div>
        </div>
      </section>

      <div className="weekly-section-heading"><span>Product performance</span><h2>Sales by product</h2><p>Last week compared with two weeks ago.</p></div>
      {error ? <div className="daily-error" role="alert">HubSpot weekly report unavailable: {error}</div> : null}
      {comparisonProducts.map((product) => <ProductComparisonCard product={product} key={product.title} />)}

      <section className="weekly-product-card weekly-refund-card" aria-label="Refunds by seller">
        <aside className="weekly-product-copy"><div><h2>Refunds</h2><strong>Per seller</strong></div><div className="weekly-product-summary"><span className={activeReport?.lastWeek.refunds ? 'down' : 'up'} aria-hidden="true">{activeReport?.lastWeek.refunds ? '↘' : '✓'}</span><strong>{activeReport?.lastWeek.refunds ? `${money.format(activeReport.lastWeek.refunds)} was refunded last week` : 'There were no refunds last week'}</strong><p>{activeReport ? `Two weeks ago refunds totaled ${money.format(activeReport.twoWeeksAgo.refunds)} across paid HubSpot deals.` : 'Loading refund totals from HubSpot.'}</p></div></aside>
        <div className="weekly-product-chart-area"><div className="weekly-chart-legend"><span><i className="refund-last" />Last week</span><span><i className="refund-prior" />Two weeks ago</span></div><div className="weekly-refund-plot"><div className="weekly-refund-groups">{refundSellers.map((seller) => <div className="weekly-refund-group" key={seller.name}><div><span className="refund-current" style={{ height: `${(seller.last / refundMaximum) * 100}%` }}>{seller.last ? <em>{money.format(seller.last)}</em> : null}</span><span className="refund-previous" style={{ height: `${(seller.prior / refundMaximum) * 100}%` }}>{seller.prior ? <em>{money.format(seller.prior)}</em> : null}</span></div><strong>{seller.name}</strong></div>)}</div></div></div>
      </section>
      </div>
    </main>
  )
}

export default Weekly
import { useEffect, useMemo, useState } from 'react'
