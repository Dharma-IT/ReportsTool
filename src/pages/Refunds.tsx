import { useState } from 'react'

function getNewYorkDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function Refunds() {
  const [fromDate, setFromDate] = useState(getNewYorkDate)
  const [toDate, setToDate] = useState(getNewYorkDate)

  return (
    <main className="dashboard-shell refunds-page">
      <section className="refunds-panel" aria-labelledby="refunds-title">
        <header className="refunds-heading">
          <div>
            <p className="eyebrow">Revenue adjustments</p>
            <h1 id="refunds-title">Refunds</h1>
            <p>Review and track customer refunds from one place.</p>
          </div>
          <div className="refunds-date-controls">
            <label><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <button type="button" disabled>Fetch</button>
          </div>
        </header>

        <div className="refunds-summary" aria-label="Refund summary">
          <article><span>Refund requests</span><strong>0</strong><small>Selected period</small></article>
          <article><span>Total refunded</span><strong>$0.00</strong><small>Processed refunds</small></article>
          <article><span>Pending</span><strong>0</strong><small>Awaiting review</small></article>
        </div>

        <section className="refunds-table-card" aria-labelledby="refunds-table-title">
          <div className="refunds-table-title">
            <div><span>Refund activity</span><strong id="refunds-table-title">Refund report</strong></div>
            <small>Coming soon</small>
          </div>
          <div className="refunds-table-wrap">
            <table className="refunds-table">
              <thead><tr><th>Date</th><th>Customer / Deal</th><th>Owner</th><th>Sale amount</th><th>Refund amount</th><th>Status</th></tr></thead>
            </table>
            <div className="refunds-empty">
              <span aria-hidden="true">↩</span>
              <strong>Refund reporting is ready for data</strong>
              <p>The HubSpot connection and refund records will be added in a future update.</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

export default Refunds
