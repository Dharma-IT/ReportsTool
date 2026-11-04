import { useEffect, useState } from 'react'

type Team = 'sales' | 'cs'
type Roster = Record<Team, string[]>
const defaultRoster: Roster = {
  sales: ['Yaneth Rodriguez', 'Alejandra Oyala', 'Carlos Vargas', 'Helen Gutierrez', 'Diana Villalobos'],
  cs: ['Arles Martinez', 'Aline Strelow', 'Brayam Zuluaga', 'Edmilson Morales'],
}
const columns = ['Number', 'Name', 'Status', 'Date', 'Calls aircall', 'Tempo Aircall', 'Tempo doxy', 'Open CV', 'Post message']
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const apiBaseUrl = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : configuredApiBaseUrl
const initials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('')

function Checker() {
  const [team, setTeam] = useState<Team>('sales')
  const [roster, setRoster] = useState<Roster>(defaultRoster)
  const [selectedMembers, setSelectedMembers] = useState<Record<Team, string>>({ sales: '', cs: '' })
  const [rosterStatus, setRosterStatus] = useState('Loading team members…')
  const members = roster[team]
  const member = members.includes(selectedMembers[team]) ? selectedMembers[team] : members[0]
  const teamLabel = team === 'sales' ? 'Sales' : 'CS'

  useEffect(() => {
    const controller = new AbortController()
    async function loadRoster() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/daily-report-agents`, { signal: controller.signal })
        if (!response.ok) throw new Error('Unable to load roster')
        const payload = await response.json() as { agents?: Record<Team, Array<{ name: string }>> }
        if (!payload.agents || !Array.isArray(payload.agents.sales) || !Array.isArray(payload.agents.cs)) throw new Error('Invalid roster')
        setRoster({ sales: payload.agents.sales.map((agent) => agent.name), cs: payload.agents.cs.map((agent) => agent.name) })
        setRosterStatus('')
      } catch {
        if (!controller.signal.aborted) setRosterStatus('Showing default members. The current team roster is unavailable.')
      }
    }
    void loadRoster()
    return () => controller.abort()
  }, [])

  return (
    <main className="home-shell checker-page">
      <header className="checker-header">
        <div><span className="home-section-index">TEAM WORKSPACE</span><h1>Checker</h1><p>Appointments, calls, and follow-up activity by team member.</p></div>
        <label className="checker-team-select">Team<select aria-label="Team" value={team} onChange={(event) => setTeam(event.target.value as Team)}><option value="sales">Sales team</option><option value="cs">CS team</option></select></label>
      </header>
      <div className="checker-layout">
        <aside className="checker-members" aria-label={`${teamLabel} team members`}>
          <div className="checker-members-heading"><span>{teamLabel} team</span><b>{members.length}</b></div>
          <p className="checker-members-hint">Select a team member</p>
          <div className="checker-member-list">{members.map((name) => <button type="button" key={name} aria-pressed={member === name} className={member === name ? 'is-active' : ''} onClick={() => setSelectedMembers((current) => ({ ...current, [team]: name }))}><span className="checker-avatar">{initials(name)}</span><span>{name}</span><span className="checker-member-arrow" aria-hidden="true">›</span></button>)}</div>
          {!members.length ? <p className="checker-roster-note">No members configured for this team.</p> : null}
          {rosterStatus ? <p className="checker-roster-note" role="status">{rosterStatus}</p> : null}
        </aside>
        <section className="checker-table-card" aria-labelledby="checker-member-heading">
          <div className="checker-table-heading"><div><span className="home-section-index">{teamLabel.toUpperCase()} / INDIVIDUAL CHECKS</span><h2 id="checker-member-heading">{member ?? 'Team member'}</h2></div><span className="checker-record-count">0 records</span></div>
          <div className="checker-table-scroll" role="region" aria-label={`${member ?? teamLabel} checker table`} tabIndex={0}>
            <table className="checker-table"><thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody><tr><td colSpan={columns.length}><div className="checker-empty"><span className="checker-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/></svg></span><strong>No checks yet</strong><p>{member ? `${member}’s records will appear here once checks are configured.` : 'Select a team member to view their checks.'}</p></div></td></tr></tbody></table>
          </div>
          <footer className="checker-table-footer"><span>Appointment & follow-up review</span><span>Checks not configured</span></footer>
        </section>
      </div>
    </main>
  )
}

export default Checker

