import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'

type DailySection = 'CS' | 'Sales'
type DailyRow = {
  staff: string
  called: number
  intents: number
  valid: number
  average: string
  aircall: string
  doxyCalls: number
  doxyValid: number
  doxyAverage: string
  doxyTotal: string
  injections: number
  nad: number
  plan: number
  peptides: number
  sales: number
  balance: number
  observation: string
}

type DailyResponse = {
  agents: Array<{
    name: string
    numbersCalled: number
    totalIntents: number
    validCalls: number
    averageCallSeconds: number
    totalTalkSeconds: number
    injections: number
    nad: number
    plan: number
    peptides: number
    sales: number
    refunds: number
    balance: number
  }>
  hubSpotAvailable?: boolean
  hubSpotError?: string | null
  message?: string
}

type SavedDailyReport = {
  team: DailySection
  fromDate: string
  toDate: string
  rows: DailyRow[]
  sourceWarning: string
  fetchedAt: string
}

const teamStaff: Record<DailySection, string[]> = {
  CS: ['Arles Martinez', 'Aline Strelow', 'Brayam Zuluaga', 'Edmilson Morales'],
  Sales: ['Andres Castro', 'Maria Claudia', 'Alejandro Rivera', 'Erika Vargas', 'Meribet Yazziet', 'Ailin Isabel'],
}

function emptyRows(team: DailySection): DailyRow[] {
  return teamStaff[team].map((staff) => ({
    staff, called: 0, intents: 0, valid: 0, average: '', aircall: '', doxyCalls: 0,
    doxyValid: 0, doxyAverage: '', doxyTotal: '', injections: 0,
    nad: 0, plan: 0, peptides: 0, sales: 0, balance: 0, observation: '',
  }))
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const apiBaseUrl = configuredApiBaseUrl === 'https://dharma-campaignreport-1.onrender.com' ? 'https://dharma-campaignreport-503z.onrender.com' : configuredApiBaseUrl
const dailyCachePrefix = 'dharma-daily-report:'

function reportCacheKey(team: DailySection, from: string, to: string) {
  return `${dailyCachePrefix}${team.toLowerCase()}:${from}:${to}`
}

function getNewYorkDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function getApiUrl(path: string) {
  return `${['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : apiBaseUrl}${path}`
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00:00'
  seconds = Math.round(seconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function durationSeconds(value: string) {
  if (!value || !/^\d+:\d{2}:\d{2}$/.test(value)) return 0
  const seconds = value.split(':').reduce((total, part) => total * 60 + Number(part), 0)
  return Number.isFinite(seconds) ? seconds : 0
}

function safeNumber(value: number | undefined) {
  return Number.isFinite(value) ? value! : 0
}

function parseCsv(text: string) {
  const records: string[][] = []
  let record: string[] = [], field = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1 } else quoted = !quoted
    } else if (character === ',' && !quoted) { record.push(field); field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      record.push(field)
      if (record.some(Boolean)) records.push(record)
      record = []; field = ''
    } else field += character
  }
  record.push(field)
  if (record.some(Boolean)) records.push(record)
  return records
}

function doxyDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : ''
}

function DailyVisualizations({ rows }: { rows: DailyRow[] }) {
  const maxCalls = Math.max(1, ...rows.map((row) => row.intents))
  const maxSales = Math.max(1, ...rows.map((row) => row.sales))

  return (
    <section className="daily-visuals" aria-labelledby="daily-visuals-title">
      <div className="daily-visuals-heading">
        <div><span>Team visuals</span><h2 id="daily-visuals-title">Performance breakdown</h2></div>
        <p>Live comparison for the selected reporting range.</p>
      </div>
      <div className="daily-chart-grid">
        <article className="daily-chart-card">
          <header><div><span>Aircall</span><h3>Call activity</h3></div><div className="daily-chart-key"><i /> Attempts <i /> Valid</div></header>
          <div className="daily-call-chart">
            {rows.map((row, index) => <div className="daily-bar-row" key={row.staff}>
              <strong>{row.staff.split(' ')[0]}</strong>
              <div className="daily-bars">
                <span className="daily-bar-attempts" style={{ width: `${(row.intents / maxCalls) * 100}%`, animationDelay: `${index * 90}ms` }}><b>{row.intents}</b></span>
                <span className="daily-bar-valid" style={{ width: `${(row.valid / maxCalls) * 100}%`, animationDelay: `${index * 90 + 80}ms` }}><b>{row.valid}</b></span>
              </div>
            </div>)}
          </div>
        </article>
        <article className="daily-chart-card daily-revenue-chart">
          <header><div><span>HubSpot</span><h3>Sales by staff</h3></div><strong>{money.format(rows.reduce((sum, row) => sum + row.sales, 0))}</strong></header>
          <div className="daily-column-chart">
            {rows.map((row, index) => <div className="daily-column" key={row.staff}>
              <div><span style={{ height: `${Math.max(row.sales > 0 ? 7 : 0, (row.sales / maxSales) * 100)}%`, animationDelay: `${index * 100}ms` }}><b>{row.sales > 0 ? money.format(row.sales) : '$0'}</b></span></div>
              <small>{row.staff.split(' ')[0]}</small>
            </div>)}
          </div>
        </article>
      </div>
    </section>
  )
}

function Daily() {
  const [activeSection, setActiveSection] = useState<DailySection>('CS')
  const [fromDate, setFromDate] = useState(getNewYorkDate)
  const [toDate, setToDate] = useState(getNewYorkDate)
  const [rows, setRows] = useState<DailyRow[]>(() => emptyRows('CS'))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLiveData, setHasLiveData] = useState(false)
  const [sourceWarning, setSourceWarning] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [reportSource, setReportSource] = useState<'live' | 'saved' | null>(null)
  const [doxyUpload, setDoxyUpload] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const doxyFileInput = useRef<HTMLInputElement>(null)
  const reportCard = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoading) return
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isLoading])

  useEffect(() => {
    if (isLoading || !fromDate || !toDate) return
    try {
      const cached = localStorage.getItem(reportCacheKey(activeSection, fromDate, toDate))
      if (!cached) {
        setRows(emptyRows(activeSection))
        setHasLiveData(false)
        setReportSource(null)
        setSourceWarning('')
        return
      }
      const saved = JSON.parse(cached) as SavedDailyReport
      if (saved.team !== activeSection || saved.fromDate !== fromDate || saved.toDate !== toDate || !Array.isArray(saved.rows)) return
      setRows(saved.rows)
      setSourceWarning(saved.sourceWarning ?? '')
      setHasLiveData(true)
      setReportSource('saved')
      setError('')
    } catch {
      setRows(emptyRows(activeSection))
      setHasLiveData(false)
      setReportSource(null)
    }
  }, [activeSection, fromDate, toDate, isLoading])

  function selectTeam(team: DailySection) {
    if (isLoading) return
    setActiveSection(team)
    setRows(emptyRows(team))
    setHasLiveData(false)
    setError('')
    setSourceWarning('')
    setReportSource(null)
    setDoxyUpload('')
  }

  async function uploadDoxyReport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setDoxyUpload('')
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Please upload the Doxy meeting history as a CSV file.')
      const records = parseCsv(await file.text())
      const headers = records.shift()?.map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase()) ?? []
      const dateIndex = headers.indexOf('date')
      const providerIndex = headers.indexOf('provider name')
      const durationIndex = headers.indexOf('duration')
      if ([dateIndex, providerIndex, durationIndex].some((index) => index < 0)) throw new Error('This CSV needs Date, Provider name, and Duration columns.')

      const metrics = new Map<string, { calls: number; valid: number; validSeconds: number; totalSeconds: number }>()
      let matchedCalls = 0
      for (const record of records) {
        const date = doxyDate(record[dateIndex] ?? '')
        if (!date || date < fromDate || date > toDate) continue
        const provider = (record[providerIndex] ?? '').trim().toLowerCase()
        if (!teamStaff.Sales.some((staff) => staff.toLowerCase() === provider)) continue
        const seconds = durationSeconds(record[durationIndex] ?? '')
        const metric = metrics.get(provider) ?? { calls: 0, valid: 0, validSeconds: 0, totalSeconds: 0 }
        metric.calls += 1
        matchedCalls += 1
        if (seconds > 0) metric.totalSeconds += seconds
        if (seconds > 60) { metric.valid += 1; metric.validSeconds += seconds }
        metrics.set(provider, metric)
      }
      if (!matchedCalls) throw new Error(`No Sales provider calls were found between ${fromDate} and ${toDate}.`)

      const uploadedRows = rows.map((row) => {
        const metric = metrics.get(row.staff.toLowerCase())
        return { ...row, doxyCalls: metric?.calls ?? 0, doxyValid: metric?.valid ?? 0,
          doxyAverage: metric?.valid ? formatDuration(metric.validSeconds / metric.valid) : '—',
          doxyTotal: metric ? formatDuration(metric.totalSeconds) : '0:00:00' }
      })
      setRows(uploadedRows)
      setHasLiveData(true)
      setDoxyUpload(`${file.name}: ${matchedCalls} calls matched the selected date range.`)
      try {
        const saved: SavedDailyReport = { team: 'Sales', fromDate, toDate, rows: uploadedRows, sourceWarning, fetchedAt: new Date().toISOString() }
        localStorage.setItem(reportCacheKey('Sales', fromDate, toDate), JSON.stringify(saved))
      } catch { /* The uploaded report still displays when browser storage is unavailable. */ }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to read the Doxy CSV file.')
    }
  }

  async function fetchDailyReport() {
    if (!fromDate || !toDate) return
    setIsLoading(true)
    setElapsedSeconds(0)
    setHasLiveData(false)
    setReportSource(null)
    setRows(emptyRows(activeSection))
    setError('')
    setSourceWarning('')
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, team: activeSection.toLowerCase() })
      const response = await fetch(getApiUrl(`/api/daily-cs-report?${params}`))
      const payload = (await response.json()) as DailyResponse
      if (!response.ok) throw new Error(payload.message ?? 'Unable to load the daily report.')
      const fetchedRows = emptyRows(activeSection).map((row) => {
        const agent = payload.agents.find((candidate) => candidate.name === row.staff)
        return agent ? {
          ...row,
          called: safeNumber(agent.numbersCalled),
          intents: safeNumber(agent.totalIntents),
          valid: safeNumber(agent.validCalls),
          average: safeNumber(agent.validCalls) ? formatDuration(safeNumber(agent.averageCallSeconds)) : '—',
          aircall: formatDuration(safeNumber(agent.totalTalkSeconds)),
          injections: safeNumber(agent.injections),
          nad: safeNumber(agent.nad),
          plan: safeNumber(agent.plan),
          peptides: safeNumber(agent.peptides),
          sales: safeNumber(agent.sales),
          balance: safeNumber(agent.balance),
        } : row
      })
      const warning = payload.hubSpotAvailable === false ? (payload.hubSpotError ?? 'HubSpot sales were unavailable.') : ''
      setRows(fetchedRows)
      setSourceWarning(warning)
      setHasLiveData(true)
      setReportSource('live')
      try {
        const saved: SavedDailyReport = { team: activeSection, fromDate, toDate, rows: fetchedRows, sourceWarning: warning, fetchedAt: new Date().toISOString() }
        localStorage.setItem(reportCacheKey(activeSection, fromDate, toDate), JSON.stringify(saved))
      } catch {
        // The live report still displays when browser storage is unavailable.
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load the daily report.')
    } finally {
      setIsLoading(false)
    }
  }

  async function exportReportImage() {
    if (!reportCard.current || !hasLiveData || isExporting) return
    setIsExporting(true)
    setError('')
    try {
      const dataUrl = await toPng(reportCard.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('daily-export-button')),
      })
      const link = document.createElement('a')
      link.download = `daily-${activeSection.toLowerCase()}-${fromDate}-${toDate}.png`
      link.href = dataUrl
      link.click()
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export the report image.')
    } finally {
      setIsExporting(false)
    }
  }

  const totals = rows.reduce((summary, row) => ({
    called: summary.called + row.called,
    intents: summary.intents + row.intents,
    valid: summary.valid + row.valid,
    talk: summary.talk + durationSeconds(row.aircall),
    weightedValid: summary.weightedValid + durationSeconds(row.average) * row.valid,
    doxyCalls: summary.doxyCalls + safeNumber(row.doxyCalls),
    doxyValid: summary.doxyValid + safeNumber(row.doxyValid),
    doxyTalk: summary.doxyTalk + durationSeconds(row.doxyTotal),
    doxyWeightedValid: summary.doxyWeightedValid + durationSeconds(row.doxyAverage) * safeNumber(row.doxyValid),
    injections: summary.injections + row.injections,
    nad: summary.nad + row.nad,
    plan: summary.plan + row.plan,
    peptides: summary.peptides + row.peptides,
    sales: summary.sales + row.sales,
    balance: summary.balance + row.balance,
  }), { called: 0, intents: 0, valid: 0, talk: 0, weightedValid: 0, doxyCalls: 0, doxyValid: 0, doxyTalk: 0, doxyWeightedValid: 0, injections: 0, nad: 0, plan: 0, peptides: 0, sales: 0, balance: 0 })

  const isSales = activeSection === 'Sales'
  const averageTotal = totals.valid ? formatDuration(Math.round(totals.weightedValid / totals.valid)) : '—'
  const doxyAverageTotal = totals.doxyValid ? formatDuration(Math.round(totals.doxyWeightedValid / totals.doxyValid)) : '—'

  return (
    <main className="dashboard-shell daily-page">
      <section className="daily-panel" aria-labelledby="daily-title">
        <aside className="daily-sidebar" aria-label="Daily teams">
          <span>Teams</span>
          {(['CS', 'Sales'] as DailySection[]).map((team) => (
            <button className={activeSection === team ? 'active' : undefined} disabled={isLoading} key={team} onClick={() => selectTeam(team)} type="button">
              <b>{team === 'CS' ? 'CS' : 'SL'}</b><span>{team}</span>
            </button>
          ))}
          {isSales && <div className="daily-doxy-upload">
            <span>Doxy data</span>
            <input ref={doxyFileInput} type="file" accept=".csv,text/csv" onChange={uploadDoxyReport} />
            <button type="button" onClick={() => doxyFileInput.current?.click()} disabled={isLoading || !fromDate || !toDate}><b>CSV</b><span>Upload Doxy</span></button>
            <small>Uses the selected date range (EST).</small>
          </div>}
        </aside>

        <div className="daily-content">
          <header className="daily-heading">
            <div>
              <p className="eyebrow">Daily performance</p>
              <h1 id="daily-title">{activeSection}</h1>
              <p>{isSales ? 'Sales activity, products and revenue at a glance.' : 'Customer care activity, products and sales at a glance.'}</p>
            </div>
            <div className="daily-date-controls">
              <label><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
              <label><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
              <button type="button" onClick={fetchDailyReport} disabled={isLoading || !fromDate || !toDate}>{isLoading ? 'Fetching both…' : 'Fetch'}</button>
            </div>
          </header>

          <div className="daily-table-card" ref={reportCard}>
            <div className="daily-table-title">
              <div><span>Live team sheet</span><strong>{activeSection} daily report</strong></div>
              <div className="daily-table-actions">
                {hasLiveData && <button className="daily-export-button" type="button" onClick={exportReportImage} disabled={isExporting}>
                  {isExporting ? 'Creating image…' : 'Export image'}
                </button>}
                <small>{hasLiveData ? (reportSource === 'saved' ? 'Saved report' : 'Live Aircall + HubSpot') : 'Awaiting fetch'}</small>
              </div>
            </div>
            {isLoading && <div className="daily-fetch-loader" role="status" aria-live="polite">
              <span className="daily-loader-spinner" aria-hidden="true" />
              <div><strong>Fetching Aircall and HubSpot</strong><p>Combining calls, products, sales, and refunds for the selected dates.</p><div className="daily-loader-track"><i /></div></div>
              <small><b>{elapsedSeconds}s elapsed</b>{elapsedSeconds < 20 ? `About ${20 - elapsedSeconds}s remaining` : 'Finishing up…'}</small>
            </div>}
            {error && <div className="daily-error" role="alert">{error}</div>}
            {sourceWarning && <div className="daily-warning" role="status">Aircall loaded, but HubSpot did not: {sourceWarning}</div>}
            {doxyUpload && <div className="daily-success" role="status">Doxy uploaded: {doxyUpload}</div>}
            {hasLiveData && <div className="daily-source-note">Aircall supplies call activity. HubSpot supplies products, sales, and refund-adjusted balance.{isSales ? ' Doxy values come from the uploaded meeting-history CSV.' : ''}</div>}
            {hasLiveData ? <><div className="daily-table-scroll">
              <table className={`daily-table ${isSales ? 'daily-sales-table' : ''}`}>
                <thead>
                  <tr className="daily-group-row">
                    <th rowSpan={2}>Staff</th><th colSpan={5}>Aircall</th>
                    {isSales && <th colSpan={4}>Doxy</th>}
                    {isSales && <th rowSpan={2}>Total time in call <small>Doxy + Aircall</small></th>}
                    <th colSpan={4}>Products sold</th><th colSpan={2}>Revenue</th><th rowSpan={2}>Observations</th>
                  </tr>
                  <tr>
                    <th>Numbers called</th><th>Total intents</th><th>Valid calls</th><th>Average call time <small>over 1 min</small></th><th>Total time</th>
                    {isSales && <><th>Video calls</th><th>Valid video calls</th><th>Average call time <small>over 1 min</small></th><th>Total Doxy time</th></>}
                    <th>Injections</th><th>NAD+</th><th>Nutritional plan</th><th>Peptides</th><th>Total sales</th><th>Balance <small>after refunds</small></th>
                  </tr>
                </thead>
                <tbody>{rows.map((row) => <tr key={row.staff}>
                  <th scope="row"><span className="daily-avatar">{row.staff.split(' ').map((name) => name[0]).join('')}</span>{row.staff}</th>
                  <td>{row.called}</td><td>{row.intents}</td><td>{row.valid}</td><td>{row.average}</td><td>{row.aircall}</td>
                  {isSales && <><td>{row.doxyCalls ?? 0}</td><td>{row.doxyValid ?? 0}</td><td>{row.doxyAverage || '—'}</td><td>{row.doxyTotal || '0:00:00'}</td><td>{formatDuration(durationSeconds(row.aircall) + durationSeconds(row.doxyTotal))}</td></>}
                  <td>{row.injections}</td><td>{row.nad}</td><td>{row.plan}</td><td>{row.peptides}</td><td className="daily-money">{money.format(row.sales)}</td><td className="daily-money">{money.format(row.balance)}</td><td>{row.observation}</td>
                </tr>)}</tbody>
                <tfoot><tr><th>Total</th><td>{totals.called}</td><td>{totals.intents}</td><td>{totals.valid}</td><td>{averageTotal}</td><td>{formatDuration(totals.talk)}</td>
                  {isSales && <><td>{totals.doxyCalls}</td><td>{totals.doxyValid}</td><td>{doxyAverageTotal}</td><td>{formatDuration(totals.doxyTalk)}</td><td>{formatDuration(totals.talk + totals.doxyTalk)}</td></>}
                  <td>{totals.injections}</td><td>{totals.nad}</td><td>{totals.plan}</td><td>{totals.peptides}</td><td>{money.format(totals.sales)}</td><td>{money.format(totals.balance)}</td><td /></tr></tfoot>
              </table>
            </div><DailyVisualizations rows={rows} /></> : !isLoading && !error ? <div className="daily-awaiting-fetch"><span aria-hidden="true">↻</span><strong>No report loaded</strong><p>Select a date range and click Fetch to load live Aircall and HubSpot values.</p></div> : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default Daily
