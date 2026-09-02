import { useCallback, useEffect, useMemo, useState } from 'react'

type Booking = {
  id: number | string
  respond_contact_id: string
  contact_phone: string | null
  booked_at: string
  meeting_start_at: string
  source_platform: string | null
  source_type: string | null
  campaign_name: string | null
  ad_name: string | null
  attribution_data?: {
    contactPhone?: string | null
  } | null
  meeting_name?: string | null
  status?: 'Completed' | 'Cancelled'
}

type BookingReport = {
  summary: {
    total: number
    fromAds: number
    byPlatform: Record<string, number>
  }
  rows: Booking[]
  manualRows?: Booking[]
  teamCounts?: { nutritionist: number; cs: number; sales: number }
  teamAppointments?: Array<{ team: 'nutritionist' | 'cs' | 'sales'; agent: string; meeting_start_at: string }>
  hubSpotWarning?: string
}

type DateField = 'booked' | 'meeting'
type SortOrder = 'booked-desc' | 'booked-asc' | 'meeting-asc' | 'meeting-desc'
type AppointmentView = 'bot' | 'manual' | 'sales' | 'team'
type SalesSummary = { total: number; bySource: Record<string, number>; validAppointments: { total: number; bySource: Record<string, number> } }
type TeamSalesSummaries = { sales: SalesSummary; cs: SalesSummary }

const csAppointmentSalesSources = ['Meta', 'TikTok', 'Repurchase', 'Follow Ups', 'Organic']
const salesAppointmentSalesSources = ['Meta', 'TikTok', 'Organic']
const appointmentSalesSourceKeys: Record<string, string> = { Meta: 'meta', TikTok: 'tiktok', Repurchase: 'repurchase', 'Follow Ups': 'follow-ups', Organic: 'organic' }

function AppointmentSalesTable({ title, sales, sources, isLoading }: { title: string; sales?: SalesSummary; sources: string[]; isLoading: boolean }) {
  const sourceCounts = sales?.validAppointments.bySource ?? {}
  const conversion = (source: string) => {
    const leads = sourceCounts[appointmentSalesSourceKeys[source]] ?? 0
    const salesCount = sales?.bySource[appointmentSalesSourceKeys[source]] ?? 0
    return leads ? `${Math.round((salesCount / leads) * 100)}%` : '0%'
  }
  return <div className="appointment-sales-card">
    <div className="appointment-sales-card-heading"><div><span>Source performance</span><h3>{title}</h3></div><small>{isLoading ? 'Loading HubSpot sales' : 'Paid-date sales'}</small></div>
    <div className="appointment-sales-table-wrap">
      <table className="appointment-sales-table">
        <thead><tr><th>Source</th><th>Valid appointments</th><th>Sales</th><th>Sales / lead source</th></tr></thead>
        <tbody>{sources.map((source) => <tr key={source}><th scope="row"><i className={`sales-source-dot ${source.toLowerCase().replace(/\s/g, '-')}`} />{source}</th><td>{sourceCounts[appointmentSalesSourceKeys[source]] ?? 0}</td><td>{isLoading ? '—' : (sales?.bySource[appointmentSalesSourceKeys[source]] ?? 0)}</td><td><span className="sales-rate-empty">{isLoading ? '—' : conversion(source)}</span></td></tr>)}</tbody>
      </table>
    </div>
  </div>
}

function AppointmentSales({ summaries, isLoading, error }: { summaries: TeamSalesSummaries | null; isLoading: boolean; error: string }) {
  const validAppointments = (summaries?.sales.validAppointments.total ?? 0) + (summaries?.cs.validAppointments.total ?? 0)
  const totalSales = (summaries?.sales.total ?? 0) + (summaries?.cs.total ?? 0)

  return (
    <section className="appointment-sales-view" aria-labelledby="appointment-sales-heading">
      <div className="appointment-sales-intro">
        <div><span>Sales attribution</span><h2 id="appointment-sales-heading">Appointment sales</h2><p>See how valid appointments turn into sales across every lead source.</p></div>
        <div className="appointment-sales-empty-badge"><i /> {isLoading ? 'Loading sales…' : error || 'Daily sales connected'}</div>
      </div>
      <div className="appointment-sales-kpis" aria-label="Appointment sales totals">
        <article><span>Valid appointments</span><strong>{isLoading ? '—' : validAppointments}</strong><small>Completed meetings</small></article>
        <article><span>Total sales</span><strong>{isLoading ? '—' : totalSales}</strong><small>Paid HubSpot deals</small></article>
        <article><span>Conversion rate</span><strong>{validAppointments ? `${Math.round((totalSales / validAppointments) * 100)}%` : '0%'}</strong><small>Sales per valid appointment</small></article>
      </div>
      <div className="appointment-sales-team-tables">
        <AppointmentSalesTable title="Sales team by lead source" sales={summaries?.sales} sources={salesAppointmentSalesSources} isLoading={isLoading} />
        <AppointmentSalesTable title="CS team by lead source" sales={summaries?.cs} sources={csAppointmentSalesSources} isLoading={isLoading} />
      </div>
    </section>
  )
}

const appointmentTeamMembers = {
  sales: ['Andres Castro', 'Maria Claudia', 'Erika Vargas', 'Meribet Yazziet', 'Ailin Isabel'],
  nutritionist: ['Maria Sandoval', 'Paula Alfonso'],
  cs: ['Arles Martinez', 'Aline Strelow', 'Brayam Zuluaga', 'Edmilson Morales'],
} as const

function AppointmentsPerTeam({ appointments, isLoading, error }: { appointments: BookingReport['teamAppointments']; isLoading: boolean; error: string }) {
  const teams = [
    { key: 'sales', label: 'Sales Team', detail: 'Seller appointment bookings' },
    { key: 'nutritionist', label: 'Nutritionist Team', detail: 'Nutrition appointment bookings' },
    { key: 'cs', label: 'CS Team', detail: 'Customer service appointment bookings' },
  ] as const
  return <section className="appointment-team-view" aria-labelledby="appointment-team-heading">
    <div className="appointment-sales-intro"><div><span>Team performance</span><h2 id="appointment-team-heading">Appointments per team</h2><p>Count of appointments booked for each assigned team.</p></div><div className="appointment-sales-empty-badge"><i /> {isLoading ? 'Loading team data…' : error ? 'Team data unavailable' : 'HubSpot assignments'}</div></div>
    {error ? <div className="call-confirmation-message error">{error}</div> : null}
    <div className="appointment-team-tables" aria-label="Appointments booked per team and agent">
      {teams.map((team) => {
        const rows = appointmentTeamMembers[team.key].map((name) => ({
          name,
          bookings: appointments?.filter((appointment) => appointment.team === team.key && appointment.agent === name).length ?? 0,
        }))
        const total = rows.reduce((sum, row) => sum + row.bookings, 0)
        return <div className="daily-table-card appointment-team-card" key={team.key}>
          <div className="daily-table-title"><div><span>Team performance</span><strong>{team.label}</strong></div><small>{team.detail}</small></div>
          <div className="daily-table-scroll"><table className="daily-table appointment-team-table">
            <thead><tr className="daily-group-row"><th>Team member</th><th>Bookings</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name}><th scope="row"><span className="daily-avatar">{row.name.split(' ').map((part) => part[0]).join('')}</span>{row.name}</th><td>{isLoading ? '—' : row.bookings}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">Total bookings</th><td>{isLoading ? '—' : total}</td></tr></tfoot>
          </table></div>
        </div>
      })}
    </div>
  </section>
}

async function parseReportResponse(response: Response) {
  if (!response.ok) throw new Error('Unable to load booking report')

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('The booking API is not configured on this deployment')
  }

  return response.json() as Promise<BookingReport>
}

const EASTERN_TIME_ZONE = 'America/New_York'

const easternDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EASTERN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function easternDateKey(value: string) {
  const parts = easternDateFormatter.formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EASTERN_TIME_ZONE,
    timeZoneName: 'short',
  }).format(new Date(value))
}

function getSource(booking: Booking) {
  const source = (booking.source_platform ?? booking.source_type ?? 'unknown').trim().toLowerCase()
  if (source.includes('facebook') || source.includes('instagram') || source.includes('meta')) return 'meta'
  if (source.includes('tik') || source.includes('byte')) return 'tiktok'
  if (source.includes('repurchase')) return 'repurchase'
  if (source.includes('follow up') || source.includes('followup')) return 'follow-ups'
  return 'organic'
}

function getPhoneNumber(booking: Booking) {
  return booking.contact_phone ?? booking.attribution_data?.contactPhone ?? '—'
}

function BotReports() {
  const [report, setReport] = useState<BookingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateField, setDateField] = useState<DateField>('booked')
  const [sortOrder, setSortOrder] = useState<SortOrder>('booked-desc')
  const [view, setView] = useState<AppointmentView>('bot')
  const [salesSummaries, setSalesSummaries] = useState<TeamSalesSummaries | null>(null)
  const [isSalesLoading, setIsSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState('')

  const loadReport = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/bot-reports/bookings', { signal })
      setReport(await parseReportResponse(response))
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Unable to load booking report')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/bot-reports/bookings', { signal: controller.signal })
      .then(parseReportResponse)
      .then(setReport)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load booking report')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (view !== 'sales') return
    if (!startDate || !endDate) { setSalesSummaries(null); setSalesError('Select a meeting date range.'); return }
    const controller = new AbortController()
    setIsSalesLoading(true); setSalesError('')
    const fetchTeamSummary = async (team: 'sales' | 'cs') => {
      const params = new URLSearchParams({ from: startDate, to: endDate, team, mode: 'sales-summary' })
      const response = await fetch(`/api/daily-cs-report?${params}`, { signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? 'Unable to load sales totals.')
      return payload as SalesSummary
    }
    Promise.all([fetchTeamSummary('sales'), fetchTeamSummary('cs')])
      .then(([sales, cs]) => setSalesSummaries({ sales, cs }))
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setSalesError(loadError instanceof Error ? loadError.message : 'Unable to load sales totals.')
        setSalesSummaries(null)
      })
      .finally(() => { if (!controller.signal.aborted) setIsSalesLoading(false) })
    return () => controller.abort()
  }, [view, startDate, endDate])

  const rows = useMemo(() => (view === 'bot' ? report?.rows ?? [] : view === 'manual' ? report?.manualRows ?? [] : [])
    .filter((booking) => {
      const value = dateField === 'meeting' ? booking.meeting_start_at : booking.booked_at
      const date = easternDateKey(value)
      return (!startDate || date >= startDate) && (!endDate || date <= endDate)
    })
    .sort((left, right) => {
      const [field, direction] = sortOrder.split('-') as ['booked' | 'meeting', 'asc' | 'desc']
      const leftValue = new Date(field === 'meeting' ? left.meeting_start_at : left.booked_at).getTime()
      const rightValue = new Date(field === 'meeting' ? right.meeting_start_at : right.booked_at).getTime()
      return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
    }), [report, startDate, endDate, dateField, sortOrder, view])

  const sourceCounts = useMemo(() => rows.reduce((counts, booking) => {
    const source = getSource(booking)
    counts[source] = (counts[source] ?? 0) + 1
    return counts
  }, {} as Record<string, number>), [rows])

  const hasDateFilter = Boolean(startDate || endDate)
  const teamAppointments = useMemo(() => {
    if (!report?.teamAppointments) return []
    return report.teamAppointments.filter((appointment) => {
      const date = easternDateKey(appointment.meeting_start_at)
      return (!startDate || date >= startDate) && (!endDate || date <= endDate)
    })
  }, [report, startDate, endDate])

  return (
    <main className="dashboard-shell bot-reports-page appointment-reports-layout">
      <aside className="appointment-reports-sidebar" aria-label="Appointment sources">
        <span>Appointment type</span>
        <button className={view === 'bot' ? 'active' : ''} type="button" onClick={() => setView('bot')}><b>AI</b><span>Bot<small>Automated bookings</small></span></button>
        <button className={view === 'manual' ? 'active' : ''} type="button" onClick={() => setView('manual')}><b>HM</b><span>Manual<small>Booked by humans</small></span></button>
        <button className={view === 'sales' ? 'active' : ''} type="button" onClick={() => { const today = easternDateKey(new Date().toISOString()); if (!startDate) setStartDate(today); if (!endDate) setEndDate(today); setView('sales') }}><b>$</b><span>Appointment Sales<small>Lead conversion</small></span></button>
        <button className={view === 'team' ? 'active' : ''} type="button" onClick={() => setView('team')}><b>TM</b><span>Apt per Team<small>Team breakdown</small></span></button>
      </aside>
      <section className="bot-reports-panel" aria-labelledby="bot-reports-title">
        <header className="bot-reports-hero">
          <div className="bot-reports-title-block">
            <p className="eyebrow">Dharma Agent Analytics</p>
            <h1 id="bot-reports-title">Appointment Reports</h1>
            <p>Bot and manually booked appointments, shown in Eastern Time.</p>
          </div>
          <div className="bot-reports-status" aria-label="Report timezone">
            <span aria-hidden="true">ET</span>
            <div><strong>Eastern Time</strong><small>America / New York</small></div>
          </div>
        </header>

        {view !== 'sales' && view !== 'team' ? <div className="bot-reports-toolbar">
          <div className="bot-date-controls" aria-label="Filter and sort bookings by date in Eastern Time">
            <label><span>Date field</span><select value={dateField} onChange={(event) => setDateField(event.target.value as DateField)}><option value="booked">Booked date</option><option value="meeting">Meeting date</option></select></label>
            <label><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
            <span className="bot-date-divider" aria-hidden="true">to</span>
            <label><span>Through</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
            <label><span>Sort by</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}><option value="booked-desc">Booked: newest</option><option value="booked-asc">Booked: oldest</option><option value="meeting-asc">Meeting: soonest</option><option value="meeting-desc">Meeting: latest</option></select></label>
            {hasDateFilter ? <button type="button" className="bot-clear-filter" onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button> : null}
          </div>
          <button type="button" className="bot-refresh-button" onClick={() => void loadReport()} disabled={isLoading}>
            <span aria-hidden="true">↻</span>{isLoading ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div> : view === 'sales' || view === 'team' ? <div className="bot-reports-toolbar appointment-sales-toolbar">
          <div className="bot-date-controls" aria-label="Filter valid appointments by meeting date in Eastern Time">
            <label><span>Meeting date from</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
            <span className="bot-date-divider" aria-hidden="true">to</span>
            <label><span>Through</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
            {hasDateFilter ? <button type="button" className="bot-clear-filter" onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button> : null}
          </div>
        </div> : null}

        {view !== 'sales' && view !== 'team' && error ? <div className="call-confirmation-message error">{error}</div> : null}
        {view !== 'sales' && view !== 'team' && report?.hubSpotWarning ? <div className="call-confirmation-message error">Manual appointments unavailable: {report.hubSpotWarning}</div> : null}
        {view !== 'sales' && view !== 'team' && isLoading && !report ? <div className="call-confirmation-message loading"><span className="report-loader-spinner" /><span>Loading bot bookings…</span></div> : null}

        {view === 'sales' ? <AppointmentSales summaries={salesSummaries} isLoading={isSalesLoading} error={salesError} /> : view === 'team' ? <AppointmentsPerTeam appointments={teamAppointments} isLoading={isLoading} error={error || report?.hubSpotWarning || ''} /> : report ? (
          <>
            <div className="bot-summary-grid" aria-label="Booking source totals">
              <article className="total"><span>{view === 'bot' ? 'Bot appointments' : 'Manual appointments'}</span><strong>{rows.length}</strong><small>{hasDateFilter ? `In selected ${dateField} date range` : 'All available appointments'}</small></article>
              <article className="meta"><span>Meta</span><strong>{sourceCounts.meta ?? 0}</strong><small>Facebook &amp; Instagram</small></article>
              <article className="tiktok"><span>TikTok</span><strong>{sourceCounts.tiktok ?? 0}</strong><small>TikTok bookings</small></article>
              <article className="organic"><span>Repurchase</span><strong>{sourceCounts.repurchase ?? 0}</strong><small>Returning patients</small></article>
              <article className="organic"><span>Follow Ups</span><strong>{sourceCounts['follow-ups'] ?? 0}</strong><small>Follow-up appointments</small></article>
              <article className="organic"><span>Organic</span><strong>{sourceCounts.organic ?? 0}</strong><small>All other sources</small></article>
            </div>

            <div className="bot-table-card">
              <div className="bot-table-heading">
                <div><h2>{view === 'bot' ? 'Bot' : 'Manual'} appointment details</h2><p>{rows.length} {rows.length === 1 ? 'appointment' : 'appointments'} · booked date in ET</p></div>
              </div>
              <div className="bot-table-wrap">
                <table className="bot-report-table">
                  <thead><tr><th>{view === 'bot' ? 'Contact ID' : 'Meeting'}</th><th>Booked at</th><th>Meeting time</th><th>Source</th><th>Phone number</th><th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((booking) => {
                      const source = getSource(booking)
                      return <tr key={booking.id}>
                        <th scope="row">{view === 'bot' ? `#${booking.respond_contact_id}` : (booking.meeting_name || `Meeting #${booking.id}`)}</th>
                        <td>{formatDateTime(booking.booked_at)}</td>
                        <td>{formatDateTime(booking.meeting_start_at)}</td>
                        <td><span className={`bot-source-pill ${source}`}>{source}</span></td>
                        <td>{getPhoneNumber(booking)}</td>
                        <td><span className={`appointment-status ${booking.status === 'Cancelled' ? 'cancelled' : 'completed'}`}>{booking.status ?? 'Completed'}</span></td>
                      </tr>
                    })}
                    {!rows.length ? <tr><td className="bot-empty-state" colSpan={6}>No {view} appointments match this Eastern Time {dateField} date range.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default BotReports
