const financeMetrics = [
  { label: 'Revenue', value: '—' },
  { label: 'Expenses', value: '—' },
  { label: 'Net income', value: '—' },
  { label: 'Cash flow', value: '—' },
]

function FinanceReport() {
  return (
    <main className="dashboard-shell finance-report-page">
      <section className="finance-report-panel" aria-labelledby="finance-report-title">
        <div className="finance-report-heading">
          <div>
            <p className="eyebrow">Financial overview</p>
            <h1 id="finance-report-title">Finance Report</h1>
            <p>A simple overview of the organization’s financial performance.</p>
          </div>
          <span className="finance-coming-soon">Coming soon</span>
        </div>

        <div className="finance-metric-grid" aria-label="Finance summary">
          {financeMetrics.map((metric) => (
            <article className="finance-metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>No data available</small>
            </article>
          ))}
        </div>

        <div className="finance-placeholder">
          <div className="finance-placeholder-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
            </svg>
          </div>
          <h2>Finance dashboard coming soon</h2>
          <p>Financial totals, trends, and reporting details will appear here when data is connected.</p>
        </div>
      </section>
    </main>
  )
}

export default FinanceReport
