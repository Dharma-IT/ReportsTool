import { useEffect, useState } from 'react'

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function BotReports() {
  const [report, setReport] = useState<BookingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadReport() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/bot-reports/bookings')
      if (!response.ok) throw new Error('Unable to load booking report')
      setReport((await response.json()) as BookingReport)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load booking report')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/bot-reports/bookings', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load booking report')
        return response.json() as Promise<BookingReport>
      })
      .then(setReport)
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load booking report')
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [])

  return (
    <main className="dashboard-shell agent-report-page">
      <section className="agent-report-panel" aria-labelledby="bot-reports-title">
        <div className="staff-performance-heading bot-reports-heading">
          <div>
            <p className="eyebrow">Dharma Agent analytics</p>
            <h1 id="bot-reports-title">Bot Reports</h1>
            <p>Bookings created by the Dharma booking bot. Times are shown in Manila time.</p>
          </div>
          <button type="button" className="agent-report-live-button" onClick={loadReport} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error ? <div className="call-confirmation-message error">{error}</div> : null}
        {isLoading ? <div className="call-confirmation-message loading">Loading bot bookings…</div> : null}

        {!isLoading && report ? (
          <>
            <div className="agent-summary-grid bot-report-summary">
              <div><span>Total bookings</span><strong>{report.summary.total}</strong></div>
              <div><span>From ads</span><strong>{report.summary.fromAds}</strong></div>
              <div><span>Organic</span><strong>{report.summary.byPlatform.organic ?? 0}</strong></div>
            </div>

            <div className="agent-report-table-card">
              <div className="agent-report-table-wrap">
                <table className="agent-report-table">
                  <thead>
                    <tr><th>Contact ID</th><th>Booked at</th><th>Meeting time</th><th>Source</th><th>Campaign</th><th>Ad</th></tr>
                  </thead>
                  <tbody>
                    {report.rows.map((booking) => (
                      <tr key={booking.id}>
                        <th scope="row">{booking.respond_contact_id}</th>
                        <td>{formatDateTime(booking.booked_at)}</td>
                        <td>{formatDateTime(booking.meeting_start_at)}</td>
                        <td>{booking.source_platform ?? booking.source_type ?? '—'}</td>
                        <td>{booking.campaign_name ?? '—'}</td>
                        <td>{booking.ad_name ?? '—'}</td>
                      </tr>
                    ))}
                    {!report.rows.length ? <tr><td colSpan={6}>No bookings found.</td></tr> : null}
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
