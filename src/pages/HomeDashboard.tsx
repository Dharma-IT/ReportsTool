const reportLinks = [
  {
    path: '/campaign',
    number: '01',
    title: 'Campaign performance',
    copy: 'Track ad spend, leads, response rates and cost per result in one report.',
    action: 'Open campaign report',
    icon: 'trend',
  },
  {
    path: '/finance-report',
    number: '02',
    title: 'Finance report',
    copy: 'Review daily revenue, product performance, expenses and profitability.',
    action: 'Open finance report',
    icon: 'finance',
  },
  {
    path: '/missed-calls',
    number: '03',
    title: 'Missed calls',
    copy: 'Review unanswered opportunities and follow-up activity by reporting date.',
    action: 'Review missed calls',
    icon: 'phone',
  },
  {
    path: '/agent-report',
    number: '04',
    title: 'Customer care',
    copy: 'See calls, messages, connection quality and bookings across the team.',
    action: 'View customer care',
    icon: 'people',
  },
  {
    path: '/daily',
    number: '05',
    title: 'Daily reports',
    copy: 'Review live Aircall and HubSpot performance across customer care and sales.',
    action: 'Open daily reports',
    icon: 'calendar',
  },
  {
    path: '/appointment-reports',
    number: '06',
    title: 'Appointment reports',
    copy: 'Review appointments booked by the bot and by the human team.',
    action: 'View appointment reports',
    icon: 'bot',
  },
  {
    path: '/ac-automation',
    number: '07',
    title: 'AC Automation',
    copy: 'Configure abandoned-cart reminders and monitor recovered orders and revenue.',
    action: 'Open cart automation',
    icon: 'cart',
  },
]

function ReportIcon({ name }: { name: string }) {
  if (name === 'finance') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5h-5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4h-5M12 6.5v11"/></svg>
  }
  if (name === 'phone') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 9.7 7 8.1 9.4a14 14 0 0 0 6.5 6.5l2.4-1.6 3.5 2.5-.8 3.1c-.3 1-1.3 1.7-2.4 1.6C9.5 20.7 3.3 14.5 2.5 6.7c-.1-1.1.6-2.1 1.6-2.4l3.1-.8Z" /></svg>
  }
  if (name === 'people') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20v-2.2c0-2.4 2.7-4.3 6-4.3s6 1.9 6 4.3V20h-12Zm12.7 0v-2.2c0-1.3-.5-2.5-1.5-3.5.6-.2 1.2-.3 1.8-.3 3.3 0 6 1.8 6 4v2h-6.3Z" /></svg>
  }
  if (name === 'calendar') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>
  }
  if (name === 'bot') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/><circle cx="12" cy="3" r="1"/></svg>
  }
  if (name === 'cart') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6.1M10 20h.01M18 20h.01" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5 8.1 13l4 3.4L21 6.5M16 6.5h5v5" /></svg>
}

function HomeDashboard() {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-kicker"><span /> Reports command center</div>
          <h1>Clarity for every<br /><em>campaign.</em></h1>
          <p>One calm place to understand campaign performance, customer conversations, and team activity.</p>
          <div className="home-hero-actions">
            <a className="home-primary-action" href="/campaign">Explore reports <span>→</span></a>
            <span className="home-status"><i /> Reporting workspace online</span>
          </div>
        </div>

        <div className="home-visual" aria-label="Animated reporting overview">
          <div className="home-orbit orbit-one" />
          <div className="home-orbit orbit-two" />
          <div className="home-visual-card">
            <div className="visual-card-head">
              <div><span>Campaign pulse</span><strong>Daily overview</strong></div>
              <i className="visual-live-dot" />
            </div>
            <div className="visual-total"><strong>Performance</strong><span>↑ LIVE</span></div>
            <svg className="home-chart" viewBox="0 0 520 220" role="img" aria-label="Animated performance trend">
              <defs>
                <linearGradient id="homeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e4b84e" stopOpacity=".34"/><stop offset="1" stopColor="#e4b84e" stopOpacity="0"/></linearGradient>
              </defs>
              <g className="home-chart-grid"><path d="M0 35H520M0 90H520M0 145H520M0 200H520" /></g>
              <path className="home-chart-area" d="M0 181 C45 165 65 173 99 138 S166 165 207 115 271 138 310 84 369 111 411 58 474 91 520 31 V220H0Z" />
              <path className="home-chart-line-glow" d="M0 181 C45 165 65 173 99 138 S166 165 207 115 271 138 310 84 369 111 411 58 474 91 520 31" />
              <path className="home-chart-line" d="M0 181 C45 165 65 173 99 138 S166 165 207 115 271 138 310 84 369 111 411 58 474 91 520 31" />
              <circle className="home-chart-point" cx="411" cy="58" r="6" />
            </svg>
            <div className="visual-legend"><span><i /> Paid media</span><span>Conversations</span><span>Team activity</span></div>
          </div>
          <div className="floating-stat stat-one"><span>Response rate</span><strong>Healthy</strong><i>↗</i></div>
          <div className="floating-stat stat-two"><span>Team activity</span><strong>In motion</strong><b><i/><i/><i/><i/></b></div>
        </div>
      </section>

      <section className="home-reports" aria-labelledby="reports-heading">
        <div className="home-section-heading">
          <div><span className="home-section-index">01 / REPORTS</span><h2 id="reports-heading">Choose your view</h2></div>
          <p>Move from the big picture to the detail that matters.</p>
        </div>
        <div className="home-report-grid">
          {reportLinks.map((report) => (
            <a className="home-report-card" href={report.path} key={report.path}>
              <span className="report-number">{report.number}</span>
              <span className="report-icon"><ReportIcon name={report.icon} /></span>
              <h3>{report.title}</h3>
              <p>{report.copy}</p>
              <strong>{report.action} <span>↗</span></strong>
            </a>
          ))}
        </div>
      </section>

      <section className="home-insight-visual" aria-labelledby="insight-visual-title">
        <div className="home-insight-copy">
          <span>LIVE WORKSPACE PULSE</span>
          <h2 id="insight-visual-title">Momentum at a glance</h2>
          <p>A visual snapshot of activity flowing across campaigns, conversations, and team reports.</p>
          <div className="home-insight-legend"><i /><span>Report activity</span><b>Updated continuously</b></div>
        </div>
        <div className="home-insight-chart" aria-label="Animated report activity trend">
          <div className="home-insight-stat"><span>Workspace trend</span><strong>Growing</strong><em>↗</em></div>
          <svg viewBox="0 0 760 280" role="img" aria-label="Rising activity line chart">
            <defs>
              <linearGradient id="insightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e1b64d" stopOpacity=".38"/><stop offset="1" stopColor="#e1b64d" stopOpacity="0"/></linearGradient>
            </defs>
            <g className="home-insight-grid"><path d="M20 45H740M20 105H740M20 165H740M20 225H740"/><path d="M120 20V250M260 20V250M400 20V250M540 20V250M680 20V250"/></g>
            <path className="home-insight-area" d="M20 230 C80 210 105 218 150 185 S230 207 280 150 365 177 420 124 510 148 565 88 655 111 740 37 V260H20Z"/>
            <path className="home-insight-glow" d="M20 230 C80 210 105 218 150 185 S230 207 280 150 365 177 420 124 510 148 565 88 655 111 740 37"/>
            <path className="home-insight-line" d="M20 230 C80 210 105 218 150 185 S230 207 280 150 365 177 420 124 510 148 565 88 655 111 740 37"/>
            <g className="home-insight-points"><circle cx="150" cy="185" r="5"/><circle cx="280" cy="150" r="5"/><circle cx="420" cy="124" r="5"/><circle cx="565" cy="88" r="5"/><circle cx="740" cy="37" r="7"/></g>
          </svg>
          <div className="home-insight-axis"><span>Campaigns</span><span>Customer care</span><span>Daily reports</span><span>Automation</span></div>
        </div>
      </section>
    </main>
  )
}

export default HomeDashboard
