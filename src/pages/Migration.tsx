import { useEffect, useRef, useState } from 'react'
import './Migration.css'
import { rebuildMigrationExports, uniqueMigrationContacts } from '../lib/migration-duplicates.js'
import PipelineMigration from './PipelineMigration'
import MigrationSpecialExport from '../components/MigrationSpecialExport'

type Contact = { name: string; phone: string; email: string }
type Batch = { number: number; contacts: Contact[] }
type Checkpoint = { after: string | null; pending: Contact[]; scanned: number; noName: number; noPhone: number; count: number; done: boolean; duplicates: number }
const initial: Checkpoint = { after: '', pending: [], scanned: 0, noName: 0, noPhone: 0, count: 0, done: false, duplicates: 0 }
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('temporary-hubspot-migration-v1', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('batches', { keyPath: 'number' })
      request.result.createObjectStore('progress')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function restore(): Promise<{ checkpoint: Checkpoint; batches: Batch[] }> {
  const db = await openDatabase()
  const saved = await new Promise<{ checkpoint: Checkpoint; batches: Batch[] }>((resolve, reject) => {
    const tx = db.transaction(['batches', 'progress'])
    const batches = tx.objectStore('batches').getAll()
    const progress = tx.objectStore('progress').get('current')
    tx.oncomplete = () => { resolve({ checkpoint: progress.result ?? initial, batches: batches.result }); db.close() }
    tx.onerror = () => { reject(tx.error); db.close() }
  })
  const rebuilt = rebuildMigrationExports(saved.batches, saved.checkpoint.pending, saved.checkpoint.done)
  const checkpoint = { ...saved.checkpoint, pending: rebuilt.pending, count: rebuilt.batches.length, duplicates: (saved.checkpoint.duplicates ?? 0) + rebuilt.duplicates }
  // Replace all batches and their checkpoint atomically, including existing browser exports.
  const writeDb = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = writeDb.transaction(['batches', 'progress'], 'readwrite')
    const store = tx.objectStore('batches')
    store.clear()
    for (const batch of rebuilt.batches) store.put(batch)
    tx.objectStore('progress').put(checkpoint, 'current')
    tx.oncomplete = () => { writeDb.close(); resolve() }
    tx.onabort = () => { writeDb.close(); reject(tx.error ?? new Error('Unable to save deduplicated exports')) }
  })
  return { checkpoint, batches: rebuilt.batches }
}
async function save(checkpoint: Checkpoint, batch?: Batch) {
  const db = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['batches', 'progress'], 'readwrite')
    if (batch) tx.objectStore('batches').put(batch)
    tx.objectStore('progress').put(checkpoint, 'current')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Unable to save migration progress')) }
  })
}
function download(batch: Batch) {
  const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`
  const csv = '\uFEFFName,Phone,Email\r\n' + batch.contacts.map(c => [c.name, c.phone, c.email].map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `hubspot-export-${batch.number}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ContactMigration() {
  const [checkpoint, setCheckpoint] = useState<Checkpoint>(initial)
  const [batches, setBatches] = useState<Batch[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stop = useRef(false)
  const running = useRef(false)
  const validContacts = batches.reduce((total, batch) => total + batch.contacts.length, checkpoint.pending.length)
  useEffect(() => {
    let active = true
    restore().then(result => { if (active) { setCheckpoint(result.checkpoint); setBatches(result.batches); setReady(true) } }).catch(() => { if (active) setError('Unable to open browser storage. Enable storage to prepare exports.') })
    return () => { active = false; stop.current = true }
  }, [])

  async function prepare() {
    if (running.current) return
    running.current = true
    stop.current = false
    setBusy(true)
    setError('')
    let current = checkpoint
    const seen = new Set([...batches.flatMap(batch => batch.contacts), ...current.pending].map(contact => contact.phone.replace(/\D/g, '')))
    try {
      while (!current.done && !stop.current) {
        if (current.after === null && current.pending.length) {
          const batch = { number: current.count + 1, contacts: current.pending }
          const next = { ...current, pending: [], count: batch.number, done: true }
          await save(next, batch)
          setBatches(previous => [...previous, batch])
          current = next
          setCheckpoint(next)
          break
        }
        const response = await fetch(`${apiBase}/api/migration/contacts?after=${encodeURIComponent(current.after ?? '')}`, { cache: 'no-store' })
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Migration API unavailable. Restart the app server with the latest code.')
        const page = await response.json()
        if (!response.ok) throw new Error(page.message ?? 'Unable to fetch HubSpot contacts')
        if (page.after !== null && page.after === current.after) throw new Error('HubSpot returned a repeated cursor. Preparation stopped to avoid duplicate exports.')
        const unique = uniqueMigrationContacts(page.contacts, seen)
        const pending = [...current.pending, ...unique.contacts]
        let batch: Batch | undefined
        if (pending.length >= 10000 || (page.after === null && pending.length > 0)) {
          batch = { number: current.count + 1, contacts: pending.splice(0, 10000) }
        }
        const next: Checkpoint = { after: page.after, pending, scanned: current.scanned + page.scanned, noName: current.noName + page.noName, noPhone: current.noPhone + page.noPhone, count: current.count + (batch ? 1 : 0), done: page.after === null && pending.length === 0, duplicates: current.duplicates + unique.duplicates }
        // A final page can complete a full batch and leave a small final export.
        if (page.after === null && pending.length > 0) {
          await save(next, batch)
          if (batch) setBatches(previous => [...previous, batch!])
          current = next
          setCheckpoint(next)
          const finalBatch = { number: next.count + 1, contacts: pending }
          const final = { ...next, pending: [], count: finalBatch.number, done: true }
          await save(final, finalBatch)
          setBatches(previous => [...previous, finalBatch])
          current = final
          setCheckpoint(final)
          break
        }
        await save(next, batch)
        current = next
        setCheckpoint(next)
        if (batch) setBatches(previous => [...previous, batch!])
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to prepare exports. Retry to resume.')
    } finally { running.current = false; setBusy(false) }
  }

  return <main className="migration-page">
    <header className="migration-header"><span className="migration-badge">Temporary workspace</span><h1>Migration</h1><p>HubSpot contacts for Bigin • Up to 10,000 contacts per CSV.</p></header>
    <MigrationSpecialExport />
    <section className="migration-panel" aria-labelledby="migration-contacts-title">
      <div className="migration-panel-heading"><div><span className="migration-eyebrow">HubSpot ? Bigin</span><h2 id="migration-contacts-title">Contact exports</h2></div><span className="migration-status">{checkpoint.done ? 'All contacts processed' : busy ? 'Preparing exports…' : 'Ready to prepare'}</span></div>
      <div className="migration-controls">
        <p>Only Name, Phone, and Email. Emails use phone digits including the country code: <strong>13475008081@dummy.com</strong>. Contacts without a name or phone are excluded. Mobile phone is used when the phone field is empty.</p>
        <p>Progress and completed exports are saved in this browser. Keep this tab open while preparing; pause or resume anytime. HubSpot contacts are read only.</p>
        <div className="migration-actions"><button disabled={!ready || busy || checkpoint.done} onClick={() => void prepare()}>{checkpoint.scanned ? 'Resume preparation' : 'Prepare exports'}</button>{busy && <button onClick={() => { stop.current = true }}>Pause after current page</button>}</div>
        <p role="status" aria-live="polite">{checkpoint.scanned.toLocaleString()} scanned · {checkpoint.noName.toLocaleString()} excluded without name · {checkpoint.noPhone.toLocaleString()} excluded without phone · {checkpoint.pending.length.toLocaleString()} in next export</p>
        {error && <p role="alert" className="migration-error">{error}</p>}
        <p>Duplicates are removed across all exports using phone digits, including the country code. The first contact found is kept.</p>
        <div className="migration-totals" aria-live="polite">
          <strong>{ready ? validContacts.toLocaleString() : 'Checking...'} {checkpoint.done ? 'final valid contacts' : 'valid contacts so far'}</strong>
          <span>{checkpoint.duplicates.toLocaleString()} duplicates removed</span>
        </div>
        {checkpoint.duplicates > 0 && <p>Download the updated exports again before importing. Previously downloaded CSV files still contain their original contacts.</p>}
      </div>
      {batches.length ? <div className="migration-export-list">{batches.map(batch => <div className="migration-export" key={batch.number}><div><h3>Export {batch.number}</h3><p>{batch.contacts.length.toLocaleString()} contacts · CSV</p></div><button onClick={() => download(batch)}>Download Export {batch.number}</button></div>)}</div> : <div className="migration-empty"><h3>No exports prepared yet</h3><p>Prepare exports to create Export 1, Export 2, and the remaining batches. The final export may contain fewer than 10,000 contacts.</p></div>}
    </section>
  </main>
}

export default function Migration() {
  const [view, setView] = useState('contacts')
  return <>
    <div className="migration-switch"><label className="migration-select">Migration type<select value={view} onChange={event => setView(event.target.value)}><option value="contacts">Contacts</option><option value="pipelines">Pipelines</option></select></label></div>
    {view === 'contacts' ? <ContactMigration /> : <main className="migration-page"><header className="migration-header"><span className="migration-badge">Temporary workspace</span><h1>Migration</h1><p>HubSpot pipelines for Bigin - up to 10,000 deals per CSV.</p></header><PipelineMigration /></main>}
  </>
}
