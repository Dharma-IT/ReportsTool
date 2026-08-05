type ReportHeroVisualProps = {
  variant: 'finance' | 'calls' | 'agents'
}

function ReportHeroVisual({ variant }: ReportHeroVisualProps) {
  if (variant === 'finance') {
    return (
      <div className="report-hero-visual finance-hero-visual" aria-hidden="true">
        <div className="finance-coin coin-one">$</div>
        <div className="finance-coin coin-two">$</div>
        <div className="finance-coin coin-three">$</div>
        <svg viewBox="0 0 300 112">
          <path className="visual-grid-line" d="M16 88H284M16 58H284M16 28H284M62 12V100M118 12V100M174 12V100M230 12V100" />
          <path className="finance-area" d="M18 91L64 72L109 78L154 47L198 53L245 22L282 29V100H18Z" />
          <path className="finance-trend" d="M18 91L64 72L109 78L154 47L198 53L245 22L282 29" />
          <circle cx="64" cy="72" r="4" /><circle cx="154" cy="47" r="4" /><circle cx="245" cy="22" r="4" />
        </svg>
        <span className="visual-caption">Revenue momentum</span>
      </div>
    )
  }

  if (variant === 'calls') {
    return (
      <div className="report-hero-visual calls-hero-visual" aria-hidden="true">
        <div className="phone-orbit"><span>☎</span></div>
        <div className="call-wave"><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="call-status"><b />Live call intelligence</div>
        <span className="signal-ring ring-one" /><span className="signal-ring ring-two" />
      </div>
    )
  }

  return (
    <div className="report-hero-visual agents-hero-visual" aria-hidden="true">
      <div className="agent-avatar avatar-one">A</div>
      <div className="agent-avatar avatar-two">K</div>
      <div className="agent-avatar avatar-three">Z</div>
      <div className="agent-performance-bars"><i /><i /><i /><i /><i /></div>
      <svg viewBox="0 0 300 112"><path d="M22 86C65 75 78 48 116 60S174 81 205 45S254 24 281 31" /></svg>
      <span className="visual-caption">Team performance</span>
    </div>
  )
}

export default ReportHeroVisual
