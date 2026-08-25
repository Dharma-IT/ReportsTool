import { useCallback, useEffect, useMemo, useState } from 'react'

type Booking = {
  id: number
  respond_contact_id: string
  booked_at: string
  meeting_start_at: string
  source_platform: string | null
  source_type: string | null
  campaign_name: string | null
  ad_name: string | null
}

type BookingReport = {
  summary: {
    total: number
    fromAds: number
    byPlatform: Record<string, number>
  }
  rows: Booking[]
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
  if (source.includes('organic')) return 'organic'
  return source || 'unknown'
}

function BotReports() {
  const [report, setReport] = useState<BookingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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

  const rows = useMemo(() => (report?.rows ?? []).filter((booking) => {
    const date = easternDateKey(booking.booked_at)
    return (!startDate || date >= startDate) && (!endDate || date <= endDate)
  }), [report, startDate, endDate])

  const sourceCounts = useMemo(() => rows.reduce((counts, booking) => {
    const source = getSource(booking)
    counts[source] = (counts[source] ?? 0) + 1
    return counts
  }, {} as Record<string, number>), [rows])

  const hasDateFilter = Boolean(startDate || endDate)

  return (
    <main className="dashboard-shell bot-reports-page">
      <section className="bot-reports-panel" aria-labelledby="bot-reports-title">
        <header className="bot-reports-hero">
          <div className="bot-reports-title-block">
            <p className="eyebrow">Dharma Agent Analytics</p>
            <h1 id="bot-reports-title">Bot Reports</h1>
            <p>Booking performance and attribution, shown in Eastern Time.</p>
          </div>
          <div className="bot-reports-status" aria-label="Report timezone">
            <span aria-hidden="true">ET</span>
            <div><strong>Eastern Time</strong><small>America / New York</small></div>
          </div>
        </header>

        <div className="bot-reports-toolbar">
          <div className="bot-date-controls" aria-label="Filter bookings by booked date in Eastern Time">
            <label><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
            <span className="bot-date-divider" aria-hidden="true">to</span>
            <label><span>Through</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
            {hasDateFilter ? <button type="button" className="bot-clear-filter" onClick={() => { setStartDate(''); setEndDate('') }}>Clear</button> : null}
          </div>
          <button type="button" className="bot-refresh-button" onClick={() => void loadReport()} disabled={isLoading}>
            <span aria-hidden="true">↻</span>{isLoading ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>

        {error ? <div className="call-confirmation-message error">{error}</div> : null}
        {isLoading && !report ? <div className="call-confirmation-message loading"><span className="report-loader-spinner" /><span>Loading bot bookings…</span></div> : null}

        {report ? (
          <>
            <div className="bot-summary-grid" aria-label="Booking source totals">
              <article className="total"><span>Total bookings</span><strong>{rows.length}</strong><small>{hasDateFilter ? 'In selected date range' : 'All available bookings'}</small></article>
              <article className="meta"><span>Meta</span><strong>{sourceCounts.meta ?? 0}</strong><small>Facebook &amp; Instagram</small></article>
              <article className="tiktok"><span>TikTok</span><strong>{sourceCounts.tiktok ?? 0}</strong><small>TikTok bookings</small></article>
              <article className="organic"><span>Organic</span><strong>{sourceCounts.organic ?? 0}</strong><small>Unpaid bookings</small></article>
            </div>

            <div className="bot-table-card">
              <div className="bot-table-heading">
                <div><h2>Booking details</h2><p>{rows.length} {rows.length === 1 ? 'booking' : 'bookings'} · booked date in ET</p></div>
              </div>
              <div className="bot-table-wrap">
                <table className="bot-report-table">
                  <thead><tr><th>Contact ID</th><th>Booked at</th><th>Meeting time</th><th>Source</th><th>Campaign</th><th>Ad</th></tr></thead>
                  <tbody>
                    {rows.map((booking) => {
                      const source = getSource(booking)
                      return <tr key={booking.id}>
                        <th scope="row">#{booking.respond_contact_id}</th>
                        <td>{formatDateTime(booking.booked_at)}</td>
                        <td>{formatDateTime(booking.meeting_start_at)}</td>
                        <td><span className={`bot-source-pill ${source}`}>{source}</span></td>
                        <td>{booking.campaign_name ?? '—'}</td>
                        <td>{booking.ad_name ?? '—'}</td>
                      </tr>
                    })}
                    {!rows.length ? <tr><td className="bot-empty-state" colSpan={6}>No bookings match this Eastern Time date range.</td></tr> : null}
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
