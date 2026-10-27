import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { aggregateWeeklyDoxy } from '../../api/_lib/weekly-contact.ts'
import WeeklyTeamReport from '../components/WeeklyTeamReport'
import type { WeeklyReport } from '../components/weekly-types'

type WeeklyTeam = 'sales' | 'cs' | 'lm' | 'cc'

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
function weeklyApiUrl(path: string) { return ['localhost', '127.0.0.1'].includes(window.location.hostname) ? path : `${configuredApiBaseUrl}${path}` }
const shiftDate = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
function latestCompletedMonday() { const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); const day = new Date(`${today}T12:00:00Z`).getUTCDay(); return shiftDate(today, -((day + 6) % 7) - 7) }
const weeklyHistoryStart = '2026-09-28'
const weekOptions = Array.from({ length: 104 }, (_, index) => shiftDate(latestCompletedMonday(), -index * 7)).filter((week) => week >= weeklyHistoryStart)
const weekLabel = (monday: string) => `${new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} â€“ ${new Date(`${shiftDate(monday, 5)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

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
    <header className="weekly-heading"><div><p className="eyebrow">Weekly {teamName.toLowerCase()} report</p><h1>{teamName} performance</h1><p>{period ? `${period.fromDate} through ${period.toDate} Â· Eastern Time` : 'Loading the latest completed HubSpot weekâ€¦'}</p></div><span>HubSpot {teamShortName} overview</span></header>
    {error ? <div className="daily-error" role="alert">HubSpot weekly report unavailable: {error}</div> : null}
    <section className="lm-volume-section"><div className="weekly-section-heading"><span>Activity snapshot</span><h2>High-level volumes</h2><p>{teamName} activity recorded in HubSpot for the latest completed week.</p></div><div className="lm-kpi-grid">{cards.map((card) => { const delta = card.current - card.previous; return <article key={card.label}><strong>{period ? card.value : 'â€”'}</strong><span>{card.label}</span>{period && prior ? <small className={delta >= 0 ? 'positive' : 'negative'}>{delta >= 0 ? 'â†—' : 'â†˜'} {card.format(Math.abs(delta))} vs two weeks ago</small> : !error ? <small>{loadingLabel}</small> : null}</article> })}</div></section>
    <section className="lm-visual-card lm-booking-chart-card"><aside><div><h2>Appointments</h2><strong>Set by LM agent</strong></div><div className="lm-chart-note"><span aria-hidden="true">â†—</span><strong>{period ? `${count.format(totals.bookings)} appointments set last week` : 'Loading appointment performanceâ€¦'}</strong><p>{prior ? `Compared with ${count.format(prior.totals.bookings)} appointments two weeks ago.` : 'Comparing the latest completed HubSpot weeks.'}</p></div></aside><div className="lm-booking-chart-area"><div className="weekly-chart-legend"><span><i className="last" />Last week</span><span><i className="average" />Two weeks ago</span></div><div className="lm-booking-chart">{bookingRows.length ? bookingRows.map((row) => <div className="lm-booking-group" key={row.name}><div><span className="last" style={{ height: `${row.last / bookingMaximum * 100}%` }}>{row.last ? <em>{row.last}</em> : null}</span><span className="prior" style={{ height: `${row.prior / bookingMaximum * 100}%` }}>{row.prior ? <em>{row.prior}</em> : null}</span></div><strong>{row.name}</strong></div>) : <p>Appointment chart will appear when HubSpot finishes loading.</p>}</div></div></section>
    <section className="lm-visual-card lm-mix-card"><aside><div><h2>Activity<br />Mix</h2><strong>By HubSpot activity</strong></div><p>See how {teamName} activity is distributed across messages, calls, and appointments.</p></aside><div className="lm-mix-visual"><div className="lm-activity-donut" style={{ background: activityDonut }} role="img" aria-label={`${teamName} activity distribution`}><span><strong>{count.format(activityTotal)}</strong><small>Total activities</small></span></div><div className="lm-mix-legend">{activityMix.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}<strong>{count.format(item.value)}</strong><small>{activityTotal ? `${(item.value / activityTotal * 100).toFixed(1)}%` : '0.0%'}</small></span></div>)}</div></div></section>
    <section className="lm-table-card"><div className="weekly-section-heading"><span>Team performance</span><h2>Agent overview</h2></div><div className="lm-table-wrap"><table><thead><tr><th>Agent</th><th>Messages</th><th>Calls</th><th>Bookings</th><th>Time in Call (TIC)</th></tr></thead><tbody>{(period?.agents ?? []).map((agent) => <tr key={agent.name}><th scope="row">{agent.name}</th><td>{count.format(agent.messages)}</td><td>{count.format(agent.calls)}</td><td>{count.format(agent.bookings)}</td><td>{duration(agent.callSeconds)}</td></tr>)}{period && !period.agents.length ? <tr><td colSpan={5}>No {teamName} activity was found for last week.</td></tr> : null}</tbody>{period ? <tfoot><tr><th scope="row">Team total</th><td>{count.format(totals.messages)}</td><td>{count.format(totals.calls)}</td><td>{count.format(totals.bookings)}</td><td>{duration(totals.callSeconds)}</td></tr></tfoot> : null}</table></div></section>
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
  const [doxyUpload, setDoxyUpload] = useState('')
  const [isDoxyUploading, setIsDoxyUploading] = useState(false)
  const [isAircallRefreshing, setIsAircallRefreshing] = useState(false)
  const [isHubSpotRefreshing, setIsHubSpotRefreshing] = useState(false)
  const doxyFileInput = useRef<HTMLInputElement>(null)
  const loadReport = useCallback(async () => {
    const response = await fetch(weeklyApiUrl(`/api/weekly-report?week=${encodeURIComponent(selectedWeek)}`))
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.message ?? 'Unable to load the weekly report.')
    setReport(payload as WeeklyReport)
  }, [selectedWeek])
  useEffect(() => {
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

  async function refreshWeeklyData(source: 'aircall' | 'hubspot') {
    setError('');
    const setRefreshing = source === 'aircall' ? setIsAircallRefreshing : setIsHubSpotRefreshing
    setRefreshing(true)
    try {
      const response = await fetch(weeklyApiUrl(`/api/weekly-report?week=${encodeURIComponent(selectedWeek)}&refresh=${source}`))
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message ?? `Unable to refresh ${source === 'aircall' ? 'Aircall' : 'HubSpot'}.`)
      setReport(payload as WeeklyReport)
    } catch (refreshError) { setError(refreshError instanceof Error ? refreshError.message : `Unable to refresh ${source === 'aircall' ? 'Aircall' : 'HubSpot'}.`) }
    finally { setRefreshing(false) }
  }

  async function uploadWeeklyDoxy(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || (activeTeam !== 'sales' && activeTeam !== 'cs')) return
    setError(''); setDoxyUpload(''); setIsDoxyUploading(true)
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Please upload the platform export as a CSV file.')
      const text = await file.text()
      const metrics = aggregateWeeklyDoxy(text, selectedWeek, shiftDate(selectedWeek, 5), activeTeam, report?.contactRosters?.[activeTeam])
      if (!metrics.length) throw new Error(`No ${activeTeam === 'sales' ? 'Sales' : 'Customer Service'} calls were found in the selected week.`)
      const response = await fetch(weeklyApiUrl(`/api/weekly-report?week=${encodeURIComponent(selectedWeek)}&team=${activeTeam}&mode=doxy`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agents: metrics, fileName: file.name }) })
      const payload = await response.json() as { message?: string; calls?: number }
      if (!response.ok) throw new Error(payload.message ?? 'Unable to save weekly contact data.')
      await loadReport(); setDoxyUpload(`${file.name}: ${payload.calls ?? 0} calls saved for the selected week.`)
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the CSV file.') }
    finally { setIsDoxyUploading(false) }
  }

  const estimatedSeconds = 50
  const etaSeconds = Math.max(0, estimatedSeconds - elapsedSeconds)
  const loadingLabel = etaSeconds ? `${elapsedSeconds}s elapsed Â· about ${etaSeconds}s remaining` : `${elapsedSeconds}s elapsed Â· finishing upâ€¦`

  const weeklyCalls = report?.calls?.[activeTeam === 'cs' ? 'cs' : 'sales']

  return (
    <main className="dashboard-shell weekly-page weekly-team-layout">
      <aside className="weekly-team-sidebar" aria-label="Weekly report teams">
        <span>Teams</span>
        <button type="button" className={activeTeam === 'sales' ? 'active' : ''} onClick={() => setActiveTeam('sales')}><b>SL</b><span>Sales<small>Sales team report</small></span></button>
        <button type="button" className={activeTeam === 'cs' ? 'active' : ''} onClick={() => setActiveTeam('cs')}><b>CS</b><span>Customer Service<small>CS team report</small></span></button>
        <button type="button" className={activeTeam === 'lm' ? 'active' : ''} onClick={() => setActiveTeam('lm')}><b>LM</b><span>Lead Management<small>LM team report</small></span></button>
        <button type="button" className={activeTeam === 'cc' ? 'active' : ''} onClick={() => setActiveTeam('cc')}><b>CC</b><span>CC Report<small>Customer Care</small></span></button>
        {(activeTeam === 'sales' || activeTeam === 'cs') ? <div className="weekly-doxy-upload"><span>Doxy history</span><input ref={doxyFileInput} type="file" accept=".csv,text/csv" onChange={(event) => uploadWeeklyDoxy(event)} /><button type="button" onClick={() => doxyFileInput.current?.click()} disabled={isDoxyUploading || isHubSpotRefreshing || isAircallRefreshing || !report}><b>CSV</b><span>{isDoxyUploading ? 'Uploadingâ€¦' : 'Upload Doxy'}</span></button><small>Applies to the selected week and team.</small></div> : null}
      </aside>
      <div className="weekly-content">
      <div className="weekly-week-picker"><label>Report week<select value={selectedWeek} disabled={isDoxyUploading || isAircallRefreshing || isHubSpotRefreshing} onChange={(event) => { setSelectedWeek(event.target.value); setReport(null); setError(''); setLoadSeconds(null); setElapsedSeconds(0); setDoxyUpload('') }}>{weekOptions.map((week) => <option value={week} key={week}>{weekLabel(week)}</option>)}</select></label>{activeTeam === 'sales' || activeTeam === 'cs' ? <button className="daily-export-button" type="button" onClick={() => refreshWeeklyData('hubspot')} disabled={isDoxyUploading || isAircallRefreshing || isHubSpotRefreshing || !report}>{isHubSpotRefreshing ? 'Refreshing HubSpot...' : 'Refresh HubSpot'}</button> : null}{report ? <span>{report.source?.selected === 'saved' ? 'Saved weekly data' : 'Fetched live and saved'} Â· comparison {report.source?.prior === 'saved' ? 'loaded from database' : 'fetched live and saved'}</span> : null}</div>
      {!report && !error ? <section className="weekly-load-status" aria-live="polite"><div><span className="weekly-load-spinner" aria-hidden="true" /><p><strong>Loading all weekly reports</strong><small>{loadingLabel}</small></p><b>ETA {etaSeconds ? `~${etaSeconds}s` : 'soon'}</b></div><i><span style={{ width: `${Math.min(94, Math.max(4, elapsedSeconds / estimatedSeconds * 100))}%` }} /></i><small>Fetching Sales, Customer Service, Lead Management, and Customer Care from HubSpot at a rate-safe pace.</small></section> : null}
      {report && loadSeconds !== null ? <div className="weekly-load-complete">âœ“ All weekly reports loaded in {loadSeconds}s</div> : null}
      {weeklyCalls?.lastWeek.aircallQuality?.warnings.map((warning) => <div className="daily-warning" role="status" key={warning}>{warning}</div>)}
      {weeklyCalls?.lastWeek.unknownDurationCalls ? <div className="daily-warning" role="status">Doxy export has {weeklyCalls.lastWeek.unknownDurationCalls} call(s) without a duration. Doxy time includes only the durations provided.</div> : null}
      {doxyUpload ? <div className="daily-success" role="status">Weekly upload saved: {doxyUpload}</div> : null}
      {activeTeam === 'lm' || activeTeam === 'cc' ? <TeamActivityReport report={report} error={error} loadingLabel={loadingLabel} team={activeTeam} /> : <WeeklyTeamReport report={report} team={activeTeam} error={error} onReconcile={() => refreshWeeklyData('aircall')} reconciling={isAircallRefreshing || isHubSpotRefreshing || isDoxyUploading} />}
      </div>
    </main>
  )
}

export default Weekly
