import { useEffect, useRef, useState } from 'react'
import { dealColumns, dealCsv } from '../lib/migration-deal-csv.js'

type Pipeline = { id: string; label: string }
type Batch = { number: number; rows: string[][] }
type Progress = { after: string | null; pending: string[][]; scanned: number; count: number; total: number; missingPhone: number; missingName: number; done: boolean }
const initial: Progress = { after: '', pending: [], scanned: 0, count: 0, total: 0, missingPhone: 0, missingName: 0, done: false }
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
async function api(query: string) {
  const response = await fetch(`${apiBase}/api/migration/deals?${query}`, { cache: 'no-store' })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Pipeline migration API unavailable. Restart the server with the latest code.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.message ?? 'Unable to load HubSpot deals')
  return result
}
function openDb(pipeline: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`temporary-hubspot-deals-v1-${pipeline}`, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('batches', { keyPath: 'number' })
      request.result.createObjectStore('progress')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function load(pipeline: string): Promise<{ progress: Progress; batches: Batch[] }> {
  const db = await openDb(pipeline)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['batches', 'progress'])
    const progress = tx.objectStore('progress').get('current')
    const batches = tx.objectStore('batches').getAll()
    tx.oncomplete = () => { db.close(); resolve({ progress: progress.result ?? initial, batches: batches.result }) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}
async function save(pipeline: string, progress: Progress, batch?: Batch) {
  const db = await openDb(pipeline)
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['batches', 'progress'], 'readwrite')
    if (batch) tx.objectStore('batches').put(batch)
    tx.objectStore('progress').put(progress, 'current')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Unable to save export progress')) }
  })
}
function download(pipeline: Pipeline, batch: Batch) {
  const url = URL.createObjectURL(new Blob([dealCsv(batch.rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `hubspot-${pipeline.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-export-${batch.number}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function PipelineExports({ pipeline }: { pipeline: Pipeline }) {
  const [progress, setProgress] = useState<Progress>(initial)
  const [batches, setBatches] = useState<Batch[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stop = useRef(false)
  const running = useRef(false)
  useEffect(() => {
    let active = true
    load(pipeline.id).then(saved => { if (active) { setProgress(saved.progress); setBatches(saved.batches); setReady(true) } }).catch(() => { if (active) setError('Browser storage unavailable. Enable storage to prepare exports.') })
    return () => { active = false; stop.current = true }
  }, [pipeline.id])
  async function prepare() {
    if (running.current) return
    running.current = true
    stop.current = false
    setBusy(true)
    setError('')
    let current = progress
    try {
      while (!current.done && !stop.current) {
        let rows: string[][] = []
        let scanned = 0, missingPhone = 0, missingName = 0
        let after = current.after
        if (current.after !== null) {
          const page = await api(`pipeline=${encodeURIComponent(pipeline.id)}&after=${encodeURIComponent(current.after)}`)
          if (page.after !== null && page.after === current.after) throw new Error('Repeated HubSpot cursor. Stopped to avoid repeating a page.')
          rows = page.rows
          scanned = page.scanned
          missingPhone = page.missingPhone
          missingName = page.missingName
          after = page.after
        }
        const pending = [...current.pending, ...rows]
        let batch: Batch | undefined
        if (pending.length >= 10000 || (after === null && pending.length)) batch = { number: current.count + 1, rows: pending.splice(0, 10000) }
        const next: Progress = { after, pending, scanned: current.scanned + scanned, total: current.total + rows.length, count: current.count + (batch ? 1 : 0), missingPhone: current.missingPhone + missingPhone, missingName: current.missingName + missingName, done: after === null && pending.length === 0 }
        await save(pipeline.id, next, batch)
        current = next
        if (stop.current) break
        setProgress(next)
        if (batch) setBatches(previous => [...previous, batch!])
      }
      // Restore the committed page after pausing, including any newly completed batch.
      if (stop.current) { const saved = await load(pipeline.id); setProgress(saved.progress); setBatches(saved.batches) }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to prepare exports. Resume to retry.') }
    finally { running.current = false; setBusy(false) }
  }
  return <section className="migration-panel" aria-labelledby="pipeline-export-title">
    <div className="migration-panel-heading"><div><span className="migration-eyebrow">HubSpot to Bigin</span><h2 id="pipeline-export-title">{pipeline.label} exports</h2></div><span className="migration-status">{progress.done ? 'All deals processed' : busy ? 'Preparing exports...' : 'Ready to prepare'}</span></div>
    <div className="migration-controls">
      <p>Up to 10,000 deals per CSV. Repeat customers and purchases are kept. Deal names exclude NEW SALE, CS, and Sellers prefixes. Email uses the deal phone digits followed by @dummy.com.</p>
      <p>All stages and paid dates are included; no yesterday filter is applied. Date/time values retain the HubSpot UTC timestamp. Progress is saved separately for each pipeline in this browser.</p>
      <details><summary>Export columns (12)</summary><ol>{dealColumns.map(column => <li key={column}>{column}</li>)}</ol></details>
      <div className="migration-actions"><button disabled={!ready || busy || progress.done} onClick={() => void prepare()}>{progress.scanned ? 'Resume preparation' : 'Prepare pipeline exports'}</button>{busy && <button onClick={() => { stop.current = true }}>Pause after current page</button>}</div>
      <p role="status">{progress.scanned.toLocaleString()} HubSpot deals scanned across all pipelines; {progress.total.toLocaleString()} belong to {pipeline.label}. {progress.pending.length.toLocaleString()} in next export.</p>
      <div className="migration-totals"><strong>{progress.total.toLocaleString()} {progress.done ? 'total exported deals' : 'pipeline deals prepared'}</strong><span>No duplicates removed</span></div>
      {(progress.missingPhone > 0 || progress.missingName > 0) && <p role="status">Review before import: {progress.missingPhone.toLocaleString()} deals have no phone/email; {progress.missingName.toLocaleString()} have no name after prefix removal. These deals remain in the exports.</p>}
      <p>Deal owners are exported as HubSpot names. Match them to Bigin users when importing. Select the destination Bigin pipeline and create matching stages first.</p>
      {error && <p role="alert" className="migration-error">{error}</p>}
    </div>
    {batches.length ? <div className="migration-export-list">{batches.map(batch => <div className="migration-export" key={batch.number}><div><h3>Export {batch.number}</h3><p>{batch.rows.length.toLocaleString()} deals - CSV</p></div><button onClick={() => download(pipeline, batch)}>Download Export {batch.number}</button></div>)}</div> : <div className="migration-empty"><h3>No pipeline exports prepared yet</h3><p>Prepare exports to create the numbered CSV files for this pipeline.</p></div>}
  </section>
}
export default function PipelineMigration() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  async function refresh() {
    setLoading(true)
    setError('')
    try { const result = await api('metadata=1'); setPipelines(result.pipelines); setSelected(previous => previous || result.pipelines[0]?.id || '') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load pipelines') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    api('metadata=1').then(result => {
      if (active) { setPipelines(result.pipelines); setSelected(result.pipelines[0]?.id || ''); setLoading(false) }
    }).catch(failure => { if (active) { setError(failure instanceof Error ? failure.message : 'Unable to load pipelines'); setLoading(false) } })
    return () => { active = false }
  }, [])
  const pipeline = pipelines.find(item => item.id === selected)
  return <>
    <label className="migration-select">HubSpot pipeline<select value={selected} onChange={event => setSelected(event.target.value)} disabled={loading}><option value="" disabled>{loading ? 'Loading pipelines...' : 'Select pipeline'}</option>{pipelines.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {error && <div className="migration-controls"><p role="alert">{error}</p><button onClick={() => void refresh()}>Retry loading pipelines</button></div>}
    {pipeline && <PipelineExports key={pipeline.id} pipeline={pipeline} />}
  </>
}
