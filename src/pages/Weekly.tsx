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
type WeeklyPeriod = { fromDate: string; toDate: string; revenue: number; refunds: number; dealCount: number; bySeller: Record<string, number>; dealCountsBySeller: Record<string, number>; averageTicketBySeller: Record<string, number>; refundsBySeller: Record<string, number>; products: Record<string, WeeklyProductTotals> }
type WeeklyProductTotals = { revenue: number; units: number; bySeller: Record<string, { revenue: number; units: number }> }
type LeadMetrics = { messages: number; calls: number; bookings: number; callSeconds: number }
type LeadPeriod = { fromDate: string; toDate: string; agents: Array<LeadMetrics & { name: string }>; days: Array<LeadMetrics & { date: string }>; totals: LeadMetrics }
type WeeklyActivityReport = { lastWeek: LeadPeriod; twoWeeksAgo: LeadPeriod }
type WeeklyCallAgent = { name: string; aircallSeconds: number; aircallCalls: number; doxySeconds: number; doxyCalls: number }
type WeeklyCalls = { lastWeek: { agents: WeeklyCallAgent[]; savedDays: number }; twoWeeksAgo: { agents: WeeklyCallAgent[]; savedDays: number } }
type NoShowPeriod = { bySeller: Record<string, { total: number; noShows: number; rate: number }> }
type WeeklyReport = { timezone: string; lastWeek: WeeklyPeriod; twoWeeksAgo: WeeklyPeriod; source?: { selected: 'live' | 'saved'; prior: 'live' | 'saved' }; calls?: { sales: WeeklyCalls; cs: WeeklyCalls }; noShows?: { lastWeek: NoShowPeriod; twoWeeksAgo: NoShowPeriod }; insights: Array<{ kind: string; title: string; detail: string }>; leadManagement?: WeeklyActivityReport; customerCare?: WeeklyActivityReport }
type WeeklyTeam = 'sales' | 'cs' | 'lm' | 'cc'

const csWeeklyNames = ['arles martinez', 'brayam zuluaga', 'brayan zuluaga', 'edmilson velasquez', 'edmilson morales', 'alice f', 'aline strelow', 'ailene nuevas']
const salesWeeklyNames = ['alejandra oyala', 'alejandra olaya', 'carlos vargas', 'yaneth rodriguez', 'diana villalobos']
const excludedWeeklyNames = ['denis reis', 'paula alfonso', 'maria sandoval']
const isCsWeeklySeller = (name: string) => csWeeklyNames.includes(name.trim().toLowerCase())
const isSalesWeeklySeller = (name: string) => salesWeeklyNames.includes(name.trim().toLowerCase())
const isExcludedWeeklySeller = (name: string) => excludedWeeklyNames.includes(name.trim().toLowerCase())

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
function weeklyApiUrl(path: string) { return ['localhost', '127.0.0.1'].includes(window.location.hostname) ? path : `${configuredApiBaseUrl}${path}` }
const shiftDate = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
function latestCompletedMonday() { const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); const day = new Date(`${today}T12:00:00Z`).getUTCDay(); return shiftDate(today, -((day + 6) % 7) - 7) }
const weeklyHistoryStart = '2026-09-28'
const weekOptions = Array.from({ length: 104 }, (_, index) => shiftDate(latestCompletedMonday(), -index * 7)).filter((week) => week >= weeklyHistoryStart)
const weekLabel = (monday: string) => `${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${shiftDate(monday, 5)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

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
  { title: 'Slim Boost', subtitle: 'Compared to Injections', direction: 'flat', summary: 'Slim Boost revenue stayed equal by $801 compared to last week', detail: 'This week we sold 9 slim boosts, compared to 9 units last week.', maximum: 100, agents: [
    { name: 'Andrés', last: 50, prior: 38, lastSales: 4, priorSales: 3 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'María C.', last: 40, prior: 80, lastSales: 2, priorSales: 4 }, { name: 'Meribet', last: 60, prior: 40, lastSales: 3, priorSales: 2 }, { name: 'Avrg', last: 32, prior: 32 },
  ] },
  { title: 'Nutr. Plan', subtitle: 'Compared to Injections', direction: 'down', summary: 'Nutritional Plan revenue decreased by $551 compared to last week', detail: 'We sold 11 nutritional plans, compared to 15 units last week.', maximum: 140, agents: [
    { name: 'Andrés', last: 0, prior: 40, lastSales: 0, priorSales: 4 }, { name: 'Alejandro', last: 0, prior: 60, lastSales: 0, priorSales: 3 }, { name: 'María C.', last: 70, prior: 125, lastSales: 5, priorSales: 2 }, { name: 'Meribet', last: 90, prior: 78, lastSales: 6, priorSales: 5 }, { name: 'Avrg', last: 70, prior: 81 },
  ] },
  { title: 'NAD+', subtitle: 'Sales per Seller', direction: 'down', summary: 'NAD+ revenue increased by $282 compared to last week', detail: 'This week we sold 3 NAD+ injections, compared to 5 units last week.', maximum: 70, agents: [
    { name: 'Andrés', last: 33, prior: 50, lastSales: 1, priorSales: 4 }, { name: 'Alejandro', last: 0, prior: 0 }, { name: 'María C.', last: 0, prior: 0 }, { name: 'Meribet', last: 66, prior: 20, lastSales: 2, priorSales: 1 }, { name: 'Avrg', last: 14, prior: 14 },
  ] },
  { title: 'Sermorelin', subtitle: 'Compared to Injections', direction: 'up', summary: 'Sermorelin revenue increased by $2,247 compared to last week', detail: 'This week we sold 17 Sermorelin, compared to 9 units last week.', maximum: 70, agents: [
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
      <div className="weekly-chart-legend"><span><i className="last" />This week</span><span><i className="average" />Last week</span></div>
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

const count = new Intl.NumberFormat('en-US')
function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function TeamActivityReport({ report, error, loadingLabel, team }: { report: WeeklyReport | null; error: string; loadingLabel: string; team: 'lm' | 'cc' }) {
  const teamReport = team === 'lm' ? report?.leadManagement : report?.customerCare
  const teamName = team === 'lm' ? 'Lead Management' : 'Customer Care'
  const teamShortName = team === 'lm' ? 'LM' : 'CC'
  const period = teamReport?.lastWeek
  const prior = teamReport?.twoWeeksAgo
  const totals = period?.totals ?? { messages: 0, calls: 0, bookings: 0, callSeconds: 0 }
  const topMessage = [...(period?.agents ?? [])].sort((a, b) => b.messages - a.messages)[0]
  const topBooking = [...(period?.agents ?? [])].sort((a, b) => b.bookings - a.bookings)[0]
  const topCall = [...(period?.agents ?? [])].sort((a, b) => b.callSeconds - a.callSeconds)[0]
  const cards = [
    { label: 'Total bookings', value: count.format(totals.bookings), current: totals.bookings, previous: prior?.totals.bookings ?? 0, format: count.format },
    { label: 'Total messages', value: count.format(totals.messages), current: totals.messages, previous: prior?.totals.messages ?? 0, format: count.format },
    { label: 'Total calls', value: count.format(totals.calls), current: totals.calls, previous: prior?.totals.calls ?? 0, format: count.format },
    { label: 'Time in call (TIC)', value: duration(totals.callSeconds), current: totals.callSeconds, previous: prior?.totals.callSeconds ?? 0, format: duration },
  ]
  const agentNames = [...new Set([...(period?.agents ?? []).map((agent) => agent.name), ...(prior?.agents ?? []).map((agent) => agent.name)])]
  const bookingRows = agentNames.map((name) => ({ name, last: period?.agents.find((agent) => agent.name === name)?.bookings ?? 0, prior: prior?.agents.find((agent) => agent.name === name)?.bookings ?? 0 }))
  const bookingMaximum = Math.max(1, ...bookingRows.flatMap((row) => [row.last, row.prior]))
  const activityMix = [
    { label: 'Messages', value: totals.messages, color: '#247b55' },
    { label: 'Calls', value: totals.calls, color: '#55c995' },
    { label: 'Appointments', value: totals.bookings, color: '#a6d5bf' },
  ]
  const activityTotal = activityMix.reduce((sum, item) => sum + item.value, 0)
  const activityDonut = activityTotal ? `conic-gradient(${activityMix.map((item, index) => { const start = activityMix.slice(0, index).reduce((sum, row) => sum + row.value, 0) / activityTotal * 100; return `${item.color} ${start}% ${start + item.value / activityTotal * 100}%` }).join(',')})` : '#e8efe9'
  return <>
    <header className="weekly-heading"><div><p className="eyebrow">Weekly {teamName.toLowerCase()} report</p><h1>{teamName} performance</h1><p>{period ? `${period.fromDate} through ${period.toDate} · Eastern Time` : 'Loading the latest completed HubSpot week…'}</p></div><span>HubSpot {teamShortName} overview</span></header>
    {error ? <div className="daily-error" role="alert">HubSpot weekly report unavailable: {error}</div> : null}
    <section className="lm-volume-section"><div className="weekly-section-heading"><span>Activity snapshot</span><h2>High-level volumes</h2><p>{teamName} activity recorded in HubSpot for the latest completed week.</p></div><div className="lm-kpi-grid">{cards.map((card) => { const delta = card.current - card.previous; return <article key={card.label}><strong>{period ? card.value : '—'}</strong><span>{card.label}</span>{period && prior ? <small className={delta >= 0 ? 'positive' : 'negative'}>{delta >= 0 ? '↗' : '↘'} {card.format(Math.abs(delta))} vs last week</small> : !error ? <small>{loadingLabel}</small> : null}</article> })}</div></section>
    <section className="lm-visual-card lm-booking-chart-card"><aside><div><h2>Appointments</h2><strong>Set by LM agent</strong></div><div className="lm-chart-note"><span aria-hidden="true">↗</span><strong>{period ? `${count.format(totals.bookings)} appointments set this week` : 'Loading appointment performance…'}</strong><p>{prior ? `Compared with ${count.format(prior.totals.bookings)} appointments last week.` : 'Comparing the latest completed HubSpot weeks.'}</p></div></aside><div className="lm-booking-chart-area"><div className="weekly-chart-legend"><span><i className="last" />This week</span><span><i className="average" />Last week</span></div><div className="lm-booking-chart">{bookingRows.length ? bookingRows.map((row) => <div className="lm-booking-group" key={row.name}><div><span className="last" style={{ height: `${row.last / bookingMaximum * 100}%` }}>{row.last ? <em>{row.last}</em> : null}</span><span className="prior" style={{ height: `${row.prior / bookingMaximum * 100}%` }}>{row.prior ? <em>{row.prior}</em> : null}</span></div><strong>{row.name}</strong></div>) : <p>Appointment chart will appear when HubSpot finishes loading.</p>}</div></div></section>
    <section className="lm-visual-card lm-mix-card"><aside><div><h2>Activity<br />Mix</h2><strong>By HubSpot activity</strong></div><p>See how {teamName} activity is distributed across messages, calls, and appointments.</p></aside><div className="lm-mix-visual"><div className="lm-activity-donut" style={{ background: activityDonut }} role="img" aria-label={`${teamName} activity distribution`}><span><strong>{count.format(activityTotal)}</strong><small>Total activities</small></span></div><div className="lm-mix-legend">{activityMix.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}<strong>{count.format(item.value)}</strong><small>{activityTotal ? `${(item.value / activityTotal * 100).toFixed(1)}%` : '0.0%'}</small></span></div>)}</div></div></section>
    <section className="lm-table-card"><div className="weekly-section-heading"><span>Team performance</span><h2>Agent overview</h2></div><div className="lm-table-wrap"><table><thead><tr><th>Agent</th><th>Messages</th><th>Calls</th><th>Bookings</th><th>Time in Call (TIC)</th></tr></thead><tbody>{(period?.agents ?? []).map((agent) => <tr key={agent.name}><th scope="row">{agent.name}</th><td>{count.format(agent.messages)}</td><td>{count.format(agent.calls)}</td><td>{count.format(agent.bookings)}</td><td>{duration(agent.callSeconds)}</td></tr>)}{period && !period.agents.length ? <tr><td colSpan={5}>No {teamName} activity was found for this week.</td></tr> : null}</tbody>{period ? <tfoot><tr><th scope="row">Team total</th><td>{count.format(totals.messages)}</td><td>{count.format(totals.calls)}</td><td>{count.format(totals.bookings)}</td><td>{duration(totals.callSeconds)}</td></tr></tfoot> : null}</table></div></section>
    <section className="weekly-major-points"><h2>Major Points</h2><div className="weekly-insight-grid">{[
      { title: topMessage ? `${topMessage.name} led messages` : 'Message activity', detail: topMessage ? `${count.format(topMessage.messages)} HubSpot communications during the week.` : 'No messages were recorded.' },
      { title: topBooking ? `${topBooking.name} led bookings` : 'Booking activity', detail: topBooking ? `${count.format(topBooking.bookings)} HubSpot meetings booked during the week.` : 'No bookings were recorded.' },
      { title: topCall ? `${topCall.name} led call time` : 'Call activity', detail: topCall ? `${duration(topCall.callSeconds)} connected time across ${count.format(topCall.calls)} calls.` : 'No calls were recorded.' },
    ].map((item) => <article key={item.title}><div className="weekly-insight-icon" aria-hidden="true"><span className="insight-bars"><i /><i /><i /></span></div><strong>{item.title}</strong><p>{item.detail}</p></article>)}</div></section>
    <section className="lm-table-card"><div className="weekly-section-heading"><span>Daily activity</span><h2>Daily activity overview</h2><p>{prior ? `Compared with ${prior.fromDate} through ${prior.toDate} in the summary above.` : 'HubSpot activity by Eastern Time day.'}</p></div><div className="lm-table-wrap"><table><thead><tr><th>Day</th><th>Messages</th><th>Calls</th><th>Bookings</th><th>Time in Call (TIC)</th></tr></thead><tbody>{(period?.days ?? []).map((day) => <tr key={day.date}><th scope="row">{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</th><td>{count.format(day.messages)}</td><td>{count.format(day.calls)}</td><td>{count.format(day.bookings)}</td><td>{duration(day.callSeconds)}</td></tr>)}</tbody></table></div></section>
  </>
}

function Weekly() {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [error, setError] = useState('')
  const [activeTeam, setActiveTeam] = useState<WeeklyTeam>('sales')
  const [selectedWeek, setSelectedWeek] = useState(latestCompletedMonday)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [loadSeconds, setLoadSeconds] = useState<number | null>(null)
  useEffect(() => {
    setReport(null); setError(''); setLoadSeconds(null); setElapsedSeconds(0)
    const controller = new AbortController()
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    fetch(weeklyApiUrl(`/api/weekly-report?week=${encodeURIComponent(selectedWeek)}`), { signal: controller.signal }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to load the weekly report.')
      return payload as WeeklyReport
    }).then((payload) => {
      setReport(payload)
      setLoadSeconds(Math.max(1, Math.ceil((Date.now() - startedAt) / 1000)))
      window.clearInterval(timer)
    }).catch((loadError: unknown) => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      window.clearInterval(timer)
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the weekly report.')
    })
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [selectedWeek])

  const estimatedSeconds = 50
  const etaSeconds = Math.max(0, estimatedSeconds - elapsedSeconds)
  const loadingLabel = etaSeconds ? `${elapsedSeconds}s elapsed · about ${etaSeconds}s remaining` : `${elapsedSeconds}s elapsed · finishing up…`

  const activeReport = useMemo(() => {
    if (!report) return null
    const filterPeriod = (period: WeeklyPeriod): WeeklyPeriod => {
      const keep = (name: string) => !isExcludedWeeklySeller(name) && (activeTeam === 'cs' ? isCsWeeklySeller(name) : isSalesWeeklySeller(name))
      const bySeller = Object.fromEntries(Object.entries(period.bySeller).filter(([name]) => keep(name)))
      const dealCountsBySeller = Object.fromEntries(Object.entries(period.dealCountsBySeller ?? {}).filter(([name]) => keep(name)))
      const averageTicketBySeller = Object.fromEntries(Object.entries(period.averageTicketBySeller ?? {}).filter(([name]) => keep(name)))
      const refundsBySeller = Object.fromEntries(Object.entries(period.refundsBySeller).filter(([name]) => keep(name)))
      const products = Object.fromEntries(Object.entries(period.products).map(([name, product]) => {
        const productSellers = Object.fromEntries(Object.entries(product.bySeller).filter(([seller]) => keep(seller)))
        return [name, { revenue: Object.values(productSellers).reduce((sum, row) => sum + row.revenue, 0), units: Object.values(productSellers).reduce((sum, row) => sum + row.units, 0), bySeller: productSellers }]
      }))
      return { ...period, revenue: Object.values(bySeller).reduce((sum, value) => sum + value, 0), refunds: Object.values(refundsBySeller).reduce((sum, value) => sum + value, 0), bySeller, dealCountsBySeller, averageTicketBySeller, refundsBySeller, products }
    }
    const lastWeek = filterPeriod(report.lastWeek)
    const twoWeeksAgo = filterPeriod(report.twoWeeksAgo)
    const revenueDelta = lastWeek.revenue - twoWeeksAgo.revenue
    const lastUnits = Object.values(lastWeek.products).reduce((sum, product) => sum + product.units, 0)
    const priorUnits = Object.values(twoWeeksAgo.products).reduce((sum, product) => sum + product.units, 0)
    const topSeller = Object.entries(lastWeek.bySeller).sort((a, b) => b[1] - a[1])[0]
    return { ...report, lastWeek, twoWeeksAgo, insights: [
      { kind: revenueDelta >= 0 ? 'up' : 'down', title: `Revenue ${revenueDelta >= 0 ? 'increased' : 'decreased'} by ${money.format(Math.abs(revenueDelta))} this week`, detail: `Revenue was ${money.format(lastWeek.revenue)} versus ${money.format(twoWeeksAgo.revenue)} last week.` },
      { kind: lastUnits >= priorUnits ? 'up' : 'down', title: `Product units ${lastUnits >= priorUnits ? 'increased' : 'decreased'} by ${Math.abs(lastUnits - priorUnits)}`, detail: `${lastUnits} units were sold this week versus ${priorUnits} last week.` },
      { kind: 'seller', title: topSeller ? `${topSeller[0]} led this week's revenue` : 'No seller revenue this week', detail: topSeller ? `${money.format(topSeller[1])} in paid HubSpot deals.` : 'No paid HubSpot deals were found for this team.' },
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
      return { title, subtitle: 'Sales per seller', direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', summary: `${title} revenue ${delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stayed equal'} by ${money.format(Math.abs(delta))} compared to last week`, detail: `This week we sold ${last.units} units, compared to ${prior.units} units last week.`, maximum: 100, agents: sellers.length ? sellers.map((name) => ({ name, last: (last.bySeller[name]?.units ?? 0) / maxUnits * 100, prior: (prior.bySeller[name]?.units ?? 0) / maxUnits * 100, lastSales: last.bySeller[name]?.units ?? 0, priorSales: prior.bySeller[name]?.units ?? 0 })) : [{ name: 'No sales', last: 0, prior: 0 }] }
    })
  }, [activeReport])
  const refundSellers = useMemo(() => {
    if (!activeReport) return [{ name: 'Loading', last: 0, prior: 0 }]
    const names = [...new Set([...Object.keys(activeReport.lastWeek.refundsBySeller), ...Object.keys(activeReport.twoWeeksAgo.refundsBySeller)])]
    const rows = names.map((name) => ({ name, last: activeReport.lastWeek.refundsBySeller[name] ?? 0, prior: activeReport.twoWeeksAgo.refundsBySeller[name] ?? 0 })).filter((row) => row.last || row.prior).sort((a, b) => Math.max(b.last, b.prior) - Math.max(a.last, a.prior))
    return rows.length ? rows : [{ name: 'No refunds', last: 0, prior: 0 }]
  }, [activeReport])
  const refundMaximum = Math.max(100, ...refundSellers.flatMap((seller) => [seller.last, seller.prior]))
  const weeklyCalls = report?.calls?.[activeTeam === 'cs' ? 'cs' : 'sales']
  const weeklyCallRows = weeklyCalls?.lastWeek.agents ?? []
  const weeklyAircallSeconds = weeklyCallRows.reduce((sum, row) => sum + row.aircallSeconds, 0)
  const weeklyDoxySeconds = weeklyCallRows.reduce((sum, row) => sum + row.doxySeconds, 0)
  const teamSeller = (name: string) => !isExcludedWeeklySeller(name) && (activeTeam === 'cs' ? isCsWeeklySeller(name) : isSalesWeeklySeller(name))
  const comparisonNames = activeReport ? [...new Set([...Object.keys(activeReport.lastWeek.bySeller), ...Object.keys(activeReport.twoWeeksAgo.bySeller)])].filter(teamSeller) : []
  const averageTicketRows = comparisonNames.map((name) => ({ name, last: activeReport!.lastWeek.averageTicketBySeller[name] ?? 0, prior: activeReport!.twoWeeksAgo.averageTicketBySeller[name] ?? 0 }))
  const noShowNames = report ? [...new Set([...Object.keys(report.noShows?.lastWeek.bySeller ?? {}), ...Object.keys(report.noShows?.twoWeeksAgo.bySeller ?? {})])].filter(teamSeller) : []
  const noShowRows = noShowNames.map((name) => ({ name, last: report!.noShows?.lastWeek.bySeller[name]?.rate ?? 0, prior: report!.noShows?.twoWeeksAgo.bySeller[name]?.rate ?? 0, total: report!.noShows?.lastWeek.bySeller[name]?.total ?? 0 }))
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
        <button type="button" className={activeTeam === 'lm' ? 'active' : ''} onClick={() => setActiveTeam('lm')}><b>LM</b><span>Lead Management<small>LM team report</small></span></button>
        <button type="button" className={activeTeam === 'cc' ? 'active' : ''} onClick={() => setActiveTeam('cc')}><b>CC</b><span>CC Report<small>Customer Care</small></span></button>
      </aside>
      <div className="weekly-content">
      <div className="weekly-week-picker"><label>Report week<select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>{weekOptions.map((week) => <option value={week} key={week}>{weekLabel(week)}</option>)}</select></label>{report ? <span>{report.source?.selected === 'saved' ? 'Saved weekly data' : 'Fetched live and saved'} · comparison {report.source?.prior === 'saved' ? 'loaded from database' : 'fetched live and saved'}</span> : null}</div>
      {!report && !error ? <section className="weekly-load-status" aria-live="polite"><div><span className="weekly-load-spinner" aria-hidden="true" /><p><strong>Loading all weekly reports</strong><small>{loadingLabel}</small></p><b>ETA {etaSeconds ? `~${etaSeconds}s` : 'soon'}</b></div><i><span style={{ width: `${Math.min(94, Math.max(4, elapsedSeconds / estimatedSeconds * 100))}%` }} /></i><small>Fetching Sales, Customer Service, Lead Management, and Customer Care from HubSpot at a rate-safe pace.</small></section> : null}
      {report && loadSeconds !== null ? <div className="weekly-load-complete">✓ All weekly reports loaded in {loadSeconds}s</div> : null}
      {activeTeam === 'lm' || activeTeam === 'cc' ? <TeamActivityReport report={report} error={error} loadingLabel={loadingLabel} team={activeTeam} /> : <>
      <header className="weekly-heading">
          <div><p className="eyebrow">Weekly {activeTeam === 'sales' ? 'sales' : 'customer service'} report</p><h1>{activeTeam === 'sales' ? 'Sales' : 'Customer Service'} performance</h1><p>{activeReport ? `${activeReport.lastWeek.fromDate} through ${activeReport.lastWeek.toDate} · Eastern Time` : 'Loading the latest completed HubSpot week…'}</p></div>
        <span>HubSpot {activeTeam === 'sales' ? 'sales' : 'CS'} overview</span>
      </header>

      <section className="weekly-total-revenue" aria-label="Total revenue this week">
        <div><span>Total revenue this week</span><strong>{activeReport ? money.format(activeReport.lastWeek.revenue) : 'Loading…'}</strong><small>{activeTeam === 'sales' ? 'Sales team' : 'Customer Service team'} · Paid HubSpot deals</small></div>
        <div className="weekly-total-comparison"><span>Last week</span><strong>{activeReport ? money.format(activeReport.twoWeeksAgo.revenue) : '—'}</strong>{activeReport ? <small className={activeReport.lastWeek.revenue >= activeReport.twoWeeksAgo.revenue ? 'positive' : 'negative'}>{activeReport.lastWeek.revenue >= activeReport.twoWeeksAgo.revenue ? '↗' : '↘'} {money.format(Math.abs(activeReport.lastWeek.revenue - activeReport.twoWeeksAgo.revenue))}</small> : null}</div>
      </section>

      <section className="lm-table-card weekly-calls-card"><div className="weekly-section-heading"><span>Customer contact</span><h2>Aircall and Doxy</h2><p>Aggregated from saved Daily dashboard reports for the selected week.</p></div><div className="lm-kpi-grid"><article><strong>{duration(weeklyAircallSeconds)}</strong><span>Aircall time</span></article><article><strong>{duration(weeklyDoxySeconds)}</strong><span>Doxy time</span></article><article><strong>{duration(weeklyAircallSeconds + weeklyDoxySeconds)}</strong><span>Total connected time</span></article><article><strong>{weeklyCalls?.lastWeek.savedDays ?? 0}/6</strong><span>Saved days included</span></article></div><div className="lm-table-wrap"><table><thead><tr><th>Agent</th><th>Aircall calls</th><th>Aircall time</th><th>Doxy calls</th><th>Doxy time</th><th>Total time</th></tr></thead><tbody>{weeklyCallRows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{count.format(row.aircallCalls)}</td><td>{duration(row.aircallSeconds)}</td><td>{count.format(row.doxyCalls)}</td><td>{duration(row.doxySeconds)}</td><td>{duration(row.aircallSeconds + row.doxySeconds)}</td></tr>)}{weeklyCalls && !weeklyCallRows.length ? <tr><td colSpan={6}>No saved Daily Aircall or Doxy data exists for this week.</td></tr> : null}</tbody></table></div></section>

      <section className="lm-table-card"><div className="weekly-section-heading"><span>HubSpot sales quality</span><h2>Average ticket</h2><p>Paid HubSpot revenue divided by paid deals, compared with last week.</p></div><div className="lm-table-wrap"><table><thead><tr><th>Agent</th><th>This week</th><th>Last week</th><th>Change</th></tr></thead><tbody>{averageTicketRows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{money.format(row.last)}</td><td>{money.format(row.prior)}</td><td className={row.last >= row.prior ? 'positive' : 'negative'}>{row.last >= row.prior ? '↗' : '↘'} {money.format(Math.abs(row.last - row.prior))}</td></tr>)}{activeReport && !averageTicketRows.length ? <tr><td colSpan={4}>No paid deals were found for this team.</td></tr> : null}</tbody></table></div></section>

      <section className="lm-table-card"><div className="weekly-section-heading"><span>HubSpot appointments</span><h2>No-show report</h2><p>HubSpot No Show Rate: canceled meetings as a percentage of all meetings.</p></div><div className="lm-table-wrap"><table><thead><tr><th>Agent</th><th>This week</th><th>Last week</th><th>Appointments reviewed</th></tr></thead><tbody>{noShowRows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.last.toFixed(1)}%</td><td>{row.prior.toFixed(1)}%</td><td>{count.format(row.total)}</td></tr>)}{report && !noShowRows.length ? <tr><td colSpan={4}>No HubSpot appointments were found for this team.</td></tr> : null}</tbody></table></div></section>

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
          <div className="weekly-growth-note"><span aria-hidden="true">↗</span><strong>We increased in revenue<br />by $7,330 this week</strong><p>We reached $44,901 in revenue this week, compared to $37,571 last week.</p></div>
        </aside>
        <div className="weekly-chart-area">
          <div className="weekly-chart-legend"><span><i className="last" />This week</span><span><i className="prior" />Last week</span><span><i className="average" />Average</span><span><i className="highest" />Highest</span></div>
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

      <div className="weekly-section-heading"><span>Product performance</span><h2>Sales by product</h2><p>This week compared with last week.</p></div>
      {error ? <div className="daily-error" role="alert">HubSpot weekly report unavailable: {error}</div> : null}
      {comparisonProducts.map((product) => <ProductComparisonCard product={product} key={product.title} />)}

      <section className="weekly-product-card weekly-refund-card" aria-label="Refunds by seller">
        <aside className="weekly-product-copy"><div><h2>Refunds</h2><strong>Per seller</strong></div><div className="weekly-product-summary"><span className={activeReport?.lastWeek.refunds ? 'down' : 'up'} aria-hidden="true">{activeReport?.lastWeek.refunds ? '↘' : '✓'}</span><strong>{activeReport?.lastWeek.refunds ? `${money.format(activeReport.lastWeek.refunds)} was refunded this week` : 'There were no refunds this week'}</strong><p>{activeReport ? `Last week refunds totaled ${money.format(activeReport.twoWeeksAgo.refunds)} across paid HubSpot deals.` : 'Loading refund totals from HubSpot.'}</p></div></aside>
        <div className="weekly-product-chart-area"><div className="weekly-chart-legend"><span><i className="refund-last" />This week</span><span><i className="refund-prior" />Last week</span></div><div className="weekly-refund-plot"><div className="weekly-refund-groups">{refundSellers.map((seller) => <div className="weekly-refund-group" key={seller.name}><div><span className="refund-current" style={{ height: `${(seller.last / refundMaximum) * 100}%` }}>{seller.last ? <em>{money.format(seller.last)}</em> : null}</span><span className="refund-previous" style={{ height: `${(seller.prior / refundMaximum) * 100}%` }}>{seller.prior ? <em>{money.format(seller.prior)}</em> : null}</span></div><strong>{seller.name}</strong></div>)}</div></div></div>
      </section>
      </>}
      </div>
    </main>
  )
}

export default Weekly
import { useEffect, useMemo, useState } from 'react'
