import { useEffect, useMemo, useRef, useState } from 'react'

type Column = { key: string; label: string; width: number; dropdown?: boolean }
type StripeContact = { phone: string; email: string; firstName: string; lastName: string }
type AcResponse = { contacts?: StripeContact[]; message?: string; unavailablePhones?: number; phoneRecovery?: Record<string, number> }
type StripeStatus = 'failed' | 'expired' | 'incomplete'
const stripeStatuses: StripeStatus[] = ['failed', 'expired', 'incomplete']

const columns: Column[] = [
  { key: 'email', label: 'Email', width: 230 }, { key: 'firstName', label: 'First Name', width: 125 },
  { key: 'lastName', label: 'Last Name', width: 125 }, { key: 'preference', label: 'Preference', width: 118, dropdown: true },
  { key: 'phone', label: 'Phone Number', width: 155 }, { key: 'treatment', label: 'Desired Treatment', width: 245, dropdown: true },
  { key: 'source', label: 'Imported Source', width: 200, dropdown: true }, { key: 'owner', label: 'Contact owner', width: 190 },
  { key: 'dealDate', label: 'Date for Deal', width: 145 },
]
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const getApiUrl = (path: string) => `${['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : configuredApiBaseUrl}${path}`
const easternToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const displayDate = (date: string) => { const [year, month, day] = date.split('-'); return `${Number(month)}/${Number(day)}/${year}` }
const contactOwners = ['Alice F', 'Arles Martinez', 'Edmilson Velasquez', 'Brayam Zuluaga', 'Maria Roa']

function downloadFile(contents: BlobPart, type: string, extension: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `ac-automation-${new Date().toISOString().slice(0, 10)}.${extension}` })
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}
const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
const escapeXml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function FilterIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4.5 8h7M7 12h2" /></svg> }

function ACAutomation() {
  const today = useMemo(() => easternToday(), [])
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [query, setQuery] = useState(''), [filtering, setFiltering] = useState(false), [exportOpen, setExportOpen] = useState(false)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [statuses, setStatuses] = useState<StripeStatus[]>(stripeStatuses)
  const exportMenu = useRef<HTMLDivElement>(null)
  const filteredRows = useMemo(() => { const term = query.trim().toLowerCase(); return term ? rows.filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(term))) : rows }, [query, rows])
  const visibleRowCount = Math.max(17, filteredRows.length)

  useEffect(() => { const close = (event: MouseEvent) => { if (!exportMenu.current?.contains(event.target as Node)) setExportOpen(false) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])

  const loadContacts = async () => {
    if (!date) { setError('Choose a valid EST date.'); return }
    if (!statuses.length) { setError('Select at least one Stripe status.'); return }
    setLoading(true); setError(''); setSummary('')
    try {
      const response = await fetch(getApiUrl(`/api/ac-automation?date=${encodeURIComponent(date)}&statuses=${encodeURIComponent(statuses.join(','))}`))
      const payload = await response.json() as AcResponse
      if (!response.ok) throw new Error(payload.message || 'Unable to load abandoned carts.')
      setRows((payload.contacts ?? []).map((contact, index) => ({
        email: contact.email, firstName: contact.firstName, lastName: contact.lastName,
        preference: '', phone: contact.phone ? `+${contact.phone}` : '', treatment: '',
        source: 'Stripe', owner: contactOwners[index % contactOwners.length], dealDate: displayDate(date),
      })))
      const recovered = Object.entries(payload.phoneRecovery ?? {}).filter(([source]) => source !== 'unavailable').map(([source, count]) => `${count} via ${source.replaceAll('_', ' ')}`).join(', ')
      setSummary(`${payload.message || `${payload.contacts?.length ?? 0} unique contacts imported. ${payload.unavailablePhones ?? 0} phone numbers unavailable.`}${recovered ? ` Phone recovery: ${recovered}.` : ''}`)
    } catch (caught) { setRows([]); setError(caught instanceof Error ? caught.message : 'Unable to load abandoned carts.') }
    finally { setLoading(false) }
  }

  const exportCsv = () => { const lines = [columns.map((column) => escapeCsv(column.label)).join(','), ...filteredRows.map((row) => columns.map((column) => escapeCsv(row[column.key] ?? '')).join(','))]; downloadFile(`\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8', 'csv'); setExportOpen(false) }
  const exportExcel = () => { const cells = (values: string[], header = false) => values.map((value) => `<Cell${header ? ' ss:StyleID="Header"' : ''}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join(''); const sheetRows = `<Row>${cells(columns.map((column) => column.label), true)}</Row>${filteredRows.map((row) => `<Row>${cells(columns.map((column) => row[column.key] ?? ''))}</Row>`).join('')}`; downloadFile(`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E5F0DF" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="AC Automation"><Table>${sheetRows}</Table></Worksheet></Workbook>`, 'application/vnd.ms-excel;charset=utf-8', 'xls'); setExportOpen(false) }

  return <main className="ac-sheet-shell">
    <header className="ac-sheet-hero"><div><span className="ac-eyebrow"><i /> Customer recovery</span><h1>AC Automation</h1><p>Stripe checkout contacts, deduplicated and ready for follow-up.</p></div><div className="ac-sheet-summary"><div><span>Total contacts</span><strong>{rows.length}</strong></div><div><span>Time zone</span><strong>EST</strong></div><i /><small>{loading ? 'Loading Stripe data...' : `${statuses.length} statuses selected`}</small></div></header>
    <section className="ac-sheet-card" aria-labelledby="ac-sheet-title">
      <div className="ac-sheet-toolbar"><div><span>ABANDONED CART DATABASE</span><h2 id="ac-sheet-title">Recovery contacts</h2></div><div className="ac-sheet-actions">
        <label className="ac-date-field">Date equals <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <fieldset className="ac-status-filter"><legend>Status</legend>{stripeStatuses.map((status) => <label key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status])} /><span>{status}</span></label>)}</fieldset>
        <button type="button" onClick={loadContacts} disabled={loading || !date}>{loading ? 'Loading...' : 'Apply'}</button>
        {filtering ? <label className="ac-sheet-search"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter contacts..." /><button type="button" onClick={() => { setFiltering(false); setQuery('') }}>×</button></label> : null}
        <button type="button" onClick={() => setFiltering(true)}><FilterIcon /> Filter</button>
        <div className="ac-export-menu" ref={exportMenu}><button type="button" disabled={!filteredRows.length} aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)}>Export <span>⌄</span></button>{exportOpen ? <div className="ac-export-options" role="menu"><button type="button" onClick={exportCsv}><b>CSV</b><span>.csv</span><small>Comma-separated values</small></button><button type="button" onClick={exportExcel}><b>Excel</b><span>.xls</span><small>Microsoft Excel workbook</small></button></div> : null}</div>
      </div></div>
      {summary ? <div className="ac-sheet-notice" role="status">{summary}</div> : null}
      {error ? <div className="ac-sheet-error" role="alert">{error}</div> : null}
      <div className="ac-spreadsheet-wrap"><table className="ac-spreadsheet" style={{ minWidth: columns.reduce((sum, column) => sum + column.width, 42) }}><colgroup><col style={{ width: 42 }} />{columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}</colgroup><thead><tr className="ac-letter-row"><th />{columns.map((column, index) => <th key={column.key}>{letters[index]}</th>)}</tr><tr className="ac-heading-row"><th>1</th>{columns.map((column) => <th key={column.key}><span>{column.label}</span><button type="button" onClick={() => setFiltering(true)}><FilterIcon /></button></th>)}</tr></thead><tbody>{Array.from({ length: visibleRowCount }, (_, index) => { const row = filteredRows[index]; return <tr key={index}><th>{index + 2}</th>{columns.map((column) => <td key={column.key}>{row?.[column.key] ?? (!row && column.dropdown ? <span className="ac-dropdown-cell"><i /></span> : '')}</td>)}</tr> })}</tbody></table>
        {!loading && !filteredRows.length ? <div className="ac-sheet-empty"><strong>{query ? 'No matching contacts' : 'No contacts'}</strong><p>{query ? `No contacts match “${query}”.` : error ? 'Correct the issue above and apply the date filter again.' : 'Choose an EST date and click Apply.'}</p></div> : null}
      </div><footer className="ac-sheet-footer"><span><i /> {loading ? 'Syncing Stripe' : 'Sheet ready'}</span><small>{filteredRows.length} records · 9 columns</small></footer>
    </section>
  </main>
}

export default ACAutomation
