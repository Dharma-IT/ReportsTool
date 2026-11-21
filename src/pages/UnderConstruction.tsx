import FinanceReport from './FinanceReport'
import BiginDateRangePicker from '../components/BiginDateRangePicker'
import BiginItemsReport from '../components/BiginItemsReport'
import { useMemo, useRef, useState } from 'react'
import type { BiginTransaction } from '../../api/_lib/bigin-transactions'
import './UnderConstruction.css'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || ''
const biginWebBase = 'https://bigin.zoho.com/bigin/org945767910/Home'
const columns: { key: keyof BiginTransaction; label: string }[] = [
  { key: 'paidDate', label: 'Paid date' }, { key: 'owner', label: 'Deal owner' }, { key: 'amount', label: 'Amount' },
  { key: 'contact', label: 'Associated contact' }, { key: 'pipeline', label: 'Pipeline' }, { key: 'phone', label: 'Phone number' },
  { key: 'dealName', label: 'Deal name' }, { key: 'stage', label: 'Deal stage' },
]
type IconName = 'sort' | 'up' | 'down' | 'wallet' | 'clock' | 'check' | 'arrow' | 'minus' | 'external'
function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, string> = {
    external: 'M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
    sort: 'M8 3v14m-4-4 4 4 4-4M16 21V7m-4 4 4-4 4 4',
    up: 'M12 20V4m-6 6 6-6 6 6', down: 'M12 4v16m-6-6 6 6 6-6',
    wallet: 'M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6m17 7h-5v4h5',
    clock: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    check: 'm5 12 4 4L19 6', arrow: 'M4 12h16m-6-6 6 6-6 6', minus: 'M6 12h12',
  }
  return <svg className={`bigin-icon ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
export default function UnderConstruction() {
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<BiginTransaction[]>([])
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [sort, setSort] = useState<{ key: keyof BiginTransaction; direction: number }>({ key: 'paidDate', direction: -1 })
  const [page, setPage] = useState(1)
  const running = useRef(false)
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key]
    return (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))) * sort.direction || a.id.localeCompare(b.id)
  }), [rows, sort])
  const agentRevenue = useMemo(() => {
    const agents = new Map<string, { name: string; cents: number; deals: number; newLeads: number; customerService: number }>()
    for (const row of rows) {
      const name = row.owner.trim() || 'Unassigned'
      const agent = agents.get(name) || { name, cents: 0, deals: 0, newLeads: 0, customerService: 0 }
      const cents = Math.round(row.amount * 100)
      agent.cents += cents
      agent.deals++
      if (row.pipeline === 'New Leads') agent.newLeads += cents
      else agent.customerService += cents
      agents.set(name, agent)
    }
    return [...agents.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name))
  }, [rows])
  const chartMin = Math.min(0, ...agentRevenue.map(agent => agent.cents / 100))
  const chartMax = Math.max(1, ...agentRevenue.map(agent => agent.cents / 100))
  const chartSpan = chartMax - chartMin
  const chartZero = -chartMin / chartSpan * 100
  const axisMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
  const total = rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100
  const pages = Math.max(1, Math.ceil(rows.length / 50))
  async function load(event?: React.FormEvent, dates?: {from:string;to:string}) {
    event?.preventDefault()
    const reportFrom = dates?.from ?? from, reportTo = dates?.to ?? to
    if (running.current) return
    if (!reportFrom || !reportTo || reportFrom > reportTo) { setError('Choose a valid date range.'); return }
    running.current = true
    setLoading(true); setError(''); setRange(null); setRows([]); setPage(1)
    try {
      const collected = new Map<string, BiginTransaction>()
      async function fetchRange(pipeline: string, start: string, end: string): Promise<void> {
        for (let next = 1; next <= 10; next++) {
          setStatus(`Loading ${pipeline}, page ${next}`)
          const query = new URLSearchParams({ from: start, to: end, pipeline, page: String(next) })
          const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : base
          const response = await fetch(`${apiBase}/api/bigin-transactions?${query}`, { signal: AbortSignal.timeout(60000) })
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The Bigin reporting API is unavailable. Deploy the updated server and try again.')
          const data = await response.json() as { rows: BiginTransaction[]; more: boolean; message?: string }
          if (!response.ok) {
            if (data.message?.includes('2,000-record') && start < end) {
              const first = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`)
              const midpoint = first + Math.floor((last - first) / 86400000 / 2) * 86400000
              await fetchRange(pipeline, start, new Date(midpoint).toISOString().slice(0, 10))
              await fetchRange(pipeline, new Date(midpoint + 86400000).toISOString().slice(0, 10), end)
              return
            }
            throw new Error(data.message || 'Unable to load Bigin transactions.')
          }
          for (const row of data.rows) collected.set(row.id, row)
          if (!data.more) break
        }
      }
      for (const pipeline of ['New Leads', 'Customer Service']) await fetchRange(pipeline, reportFrom, reportTo)
      setRows([...collected.values()]); setRange({ from: reportFrom, to: reportTo })
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load Bigin transactions.') }
    finally { setLoading(false); setStatus(''); running.current = false }
  }
  return <main className="bigin-report">
    <header className="bigin-heading"><div><span className="bigin-eyebrow"><Icon name="wallet" /> Bigin <span className="bigin-separator" /> Finance</span><h1>Paid transactions</h1><p>New Leads and Customer Service, together in one report.</p></div><span className="bigin-source"><span className="bigin-live-dot" />Live from Bigin</span></header>
    <form className="bigin-filters" onSubmit={load}>
      <BiginDateRangePicker from={from} to={to} disabled={loading} onApply={dates => {setFrom(dates.from);setTo(dates.to);void load(undefined,dates)}} />
      <button disabled={loading} type="submit">{loading ? 'Loading...' : <>Apply dates <Icon name="arrow" /></>}</button>
      <p><span><Icon name="clock" />Eastern Time (EST/EDT)</span><span><Icon name="check" />Paid Date field</span><span><Icon name="check" />PAID stage only</span></p>
    </form>
    {error && <p role="alert" className="bigin-error">{error}</p>}
    <section className="bigin-summary" aria-label="Transaction totals">
      <article><span>Total paid amount</span><strong>{range ? money.format(total) : <Icon name="minus" />}</strong><small>{range ? `${range.from} through ${range.to}` : 'Apply dates to load your report'}</small></article>
      <article><span>Paid deals</span><strong>{range ? rows.length.toLocaleString() : <Icon name="minus" />}</strong><small>Both pipelines combined</small></article>
      {['New Leads', 'Customer Service'].map(pipeline => <article key={pipeline}><span>{pipeline}</span><strong>{range ? money.format(rows.filter(r => r.pipeline === pipeline).reduce((sum, r) => sum + Math.round(r.amount * 100), 0) / 100) : <Icon name="minus" />}</strong><small>{range ? `${rows.filter(r => r.pipeline === pipeline).length.toLocaleString()} paid deals` : 'Awaiting report'}</small></article>)}
    </section>
    <section className="bigin-agent-card" aria-labelledby="bigin-agent-title">
      <div className="bigin-agent-heading"><div><span className="bigin-eyebrow">Team performance</span><h2 id="bigin-agent-title">Revenue per sales agent</h2><p>New Leads + Customer Service, grouped by deal owner.</p></div><span className="bigin-agent-caption">{range ? `${agentRevenue.length} agents / ${money.format(total)}` : 'Combined paid revenue'}</span></div>
      {loading ? <p className="bigin-empty" role="status">Loading agent revenue...</p> : !range ? <p className="bigin-empty">Apply your paid date range to compare revenue per agent.</p> : !agentRevenue.length ? <p className="bigin-empty">No paid revenue in the selected date range.</p> : <>
        <div className="bigin-agent-scroll"><ol className="bigin-agent-chart" aria-label="Combined paid revenue by deal owner, highest first">
          {agentRevenue.map(agent => <li className="bigin-agent-row" key={agent.name} title={`${agent.name}: New Leads ${money.format(agent.newLeads / 100)}, Customer Service ${money.format(agent.customerService / 100)}`}>
            <div className="bigin-agent-name"><strong>{agent.name}</strong><small>{agent.deals} paid {agent.deals === 1 ? 'deal' : 'deals'}</small></div>
            <div className="bigin-agent-track" aria-hidden="true"><span className="bigin-agent-zero" style={{ left: `${chartZero}%` }} /><span className={`bigin-agent-bar${agent.cents < 0 ? ' is-negative' : ''}`} style={{ left: `${(Math.min(0, agent.cents / 100) - chartMin) / chartSpan * 100}%`, width: `${Math.abs(agent.cents / 100) / chartSpan * 100}%` }} /></div>
            <strong className="bigin-agent-value">{money.format(agent.cents / 100)}</strong>
          </li>)}
        </ol></div>
        <div className="bigin-agent-axis" aria-hidden="true"><span /> <div>{Array.from({ length: 5 }, (_, index) => <span key={index}>{axisMoney.format(chartMin + chartSpan * index / 4)}</span>)}</div><span /></div>
        <p className="bigin-agent-footnote">Total paid amount (USD) / {range.from} through {range.to}</p>
      </>}
    </section>
    <section className="bigin-table-card"><div className="bigin-table-heading"><h2>Transactions</h2><span>{range ? `${rows.length.toLocaleString()} records / USD` : 'USD'}</span></div>
      {loading ? <p className="bigin-empty" role="status">{status}. Totals appear after both pipelines finish loading.</p> : !range ? <p className="bigin-empty">Choose your paid date range and apply dates to view transactions.</p> : !rows.length ? <p className="bigin-empty" role="status">No PAID deals with a Paid Date in this range were found in either pipeline.</p> : <>
        <div className="bigin-table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key} aria-sort={sort.key === column.key ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => { setSort({ key: column.key, direction: sort.key === column.key ? -sort.direction : 1 }); setPage(1) }}>{column.label} <Icon name={sort.key === column.key ? sort.direction === 1 ? 'up' : 'down' : 'sort'} /></button></th>)}</tr></thead>
        <tbody>{sorted.slice((page - 1) * 50, page * 50).map(row => <tr key={row.id}><td>{row.paidDate}</td><td>{row.owner || 'Unassigned'}</td><td className="bigin-amount">{money.format(row.amount)}</td><td><strong>{row.contact || 'No contact'}</strong>{row.email && <small>{row.email}</small>}</td><td><span className="bigin-pipeline">{row.pipeline}</span></td><td>{row.phone || 'Not provided'}</td><td><a className="bigin-deal-link" href={`${biginWebBase}#/deals/${encodeURIComponent(row.id)}?section=notes`} target="_blank" rel="noopener noreferrer" aria-label={`${row.dealName} (opens in Bigin in a new tab)`}>{row.dealName}<Icon name="external" /></a></td><td><span className="bigin-paid">{row.stage}</span></td></tr>)}</tbody></table></div>
        <footer className="bigin-pagination"><span>{(page - 1) * 50 + 1} to {Math.min(page * 50, rows.length)} of {rows.length.toLocaleString()}</span><div><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button></div></footer>
      </>}
    </section>
    <BiginItemsReport rows={rows} range={range} reportLoading={loading} />
    <FinanceReport source="bigin" embedded />
  </main>
}
