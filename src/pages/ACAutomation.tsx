import { useEffect, useMemo, useRef, useState } from 'react'

type Column = {
  key: string
  label: string
  width: number
  dropdown?: boolean
}

const columns: Column[] = [
  { key: 'email', label: 'Email', width: 230 },
  { key: 'firstName', label: 'First Name', width: 125 },
  { key: 'lastName', label: 'Last Name', width: 125 },
  { key: 'preference', label: 'Preference', width: 118, dropdown: true },
  { key: 'phone', label: 'Phone Number', width: 155 },
  { key: 'treatment', label: 'Desired Treatment', width: 245, dropdown: true },
  { key: 'source', label: 'Imported Source', width: 200, dropdown: true },
  { key: 'owner', label: 'Contact owner', width: 190 },
  { key: 'dealDate', label: 'Date for Deal', width: 145 },
]

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const rows: Record<string, string>[] = []

function downloadFile(contents: BlobPart, type: string, extension: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ac-automation-${new Date().toISOString().slice(0, 10)}.${extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function FilterIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4.5 8h7M7 12h2" /></svg>
}

function ACAutomation() {
  const [filtering, setFiltering] = useState(false)
  const [query, setQuery] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const exportMenu = useRef<HTMLDivElement>(null)
  const rowNumbers = useMemo(() => Array.from({ length: 18 }, (_, index) => index + 1), [])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!exportMenu.current?.contains(event.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const exportCsv = () => {
    const lines = [columns.map((column) => escapeCsv(column.label)).join(','), ...rows.map((row) => columns.map((column) => escapeCsv(row[column.key] ?? '')).join(','))]
    downloadFile(`\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8', 'csv')
    setExportOpen(false)
  }

  const exportExcel = () => {
    const cells = (values: string[], header = false) => values.map((value) => `<Cell${header ? ' ss:StyleID="Header"' : ''}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join('')
    const sheetRows = `<Row>${cells(columns.map((column) => column.label), true)}</Row>${rows.map((row) => `<Row>${cells(columns.map((column) => row[column.key] ?? ''))}</Row>`).join('')}`
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E5F0DF" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="AC Automation"><Table>${sheetRows}</Table></Worksheet></Workbook>`
    downloadFile(workbook, 'application/vnd.ms-excel;charset=utf-8', 'xls')
    setExportOpen(false)
  }

  return (
    <main className="ac-sheet-shell">
      <header className="ac-sheet-hero">
        <div>
          <span className="ac-eyebrow"><i /> Customer recovery</span>
          <h1>AC Automation</h1>
          <p>Abandoned-cart contacts, organized and ready for follow-up.</p>
        </div>
        <div className="ac-sheet-summary">
          <div><span>Total contacts</span><strong>0</strong></div>
          <div><span>Added today</span><strong>0</strong></div>
          <i />
          <small>Awaiting data connection</small>
        </div>
      </header>

      <section className="ac-sheet-card" aria-labelledby="ac-sheet-title">
        <div className="ac-sheet-toolbar">
          <div>
            <span>ABANDONED CART DATABASE</span>
            <h2 id="ac-sheet-title">Recovery contacts</h2>
          </div>
          <div className="ac-sheet-actions">
            {filtering ? <label className="ac-sheet-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter contacts…" /><button type="button" onClick={() => { setFiltering(false); setQuery('') }}>×</button></label> : null}
            <button type="button" onClick={() => setFiltering(true)}><FilterIcon /> Filter</button>
            <div className="ac-export-menu" ref={exportMenu}>
              <button type="button" aria-expanded={exportOpen} onClick={() => setExportOpen((open) => !open)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M5 7l3 3 3-3M3 13h10" /></svg> Export <span>⌄</span></button>
              {exportOpen ? <div className="ac-export-options" role="menu">
                <button type="button" role="menuitem" onClick={exportCsv}><b>CSV</b><span>.csv</span><small>Comma-separated values</small></button>
                <button type="button" role="menuitem" onClick={exportExcel}><b>Excel</b><span>.xls</span><small>Microsoft Excel workbook</small></button>
              </div> : null}
            </div>
          </div>
        </div>

        <div className="ac-spreadsheet-wrap">
          <table className="ac-spreadsheet" style={{ minWidth: columns.reduce((total, column) => total + column.width, 42) }}>
            <colgroup><col style={{ width: 42 }} />{columns.map((column) => <col key={column.key} style={{ width: column.width }} />)}</colgroup>
            <thead>
              <tr className="ac-letter-row"><th aria-label="Row number" />{columns.map((column, index) => <th key={column.key}>{letters[index]}</th>)}</tr>
              <tr className="ac-heading-row">
                <th>1</th>
                {columns.map((column) => <th key={column.key}><span>{column.label}</span><button type="button" aria-label={`Filter ${column.label}`} onClick={() => setFiltering(true)}><FilterIcon /></button></th>)}
              </tr>
            </thead>
            <tbody>
              {rowNumbers.slice(1).map((row) => (
                <tr key={row}>
                  <th>{row + 1}</th>
                  {columns.map((column) => <td key={column.key}>{column.dropdown ? <span className="ac-dropdown-cell"><i /></span> : null}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ac-sheet-empty">
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 10h16M9 5v14" /></svg></span>
            <strong>No contacts yet</strong>
            <p>{query ? `No contacts match “${query}”.` : 'Your abandoned-cart data will populate this sheet once connected.'}</p>
          </div>
        </div>
        <footer className="ac-sheet-footer"><span><i /> Sheet ready</span><small>0 records · 9 columns</small></footer>
      </section>
    </main>
  )
}

export default ACAutomation
