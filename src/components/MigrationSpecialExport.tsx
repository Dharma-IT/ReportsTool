import { useEffect, useState } from 'react'
import { specialExportContacts, specialExportCsv } from '../lib/migration-special-export.js'
import type { SpecialExport } from '../lib/migration-special-export.js'

const storageKey = 'migration-special-export-v1'
export default function MigrationSpecialExport() {
  const [result, setResult] = useState<SpecialExport | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed.contacts)) Promise.resolve().then(() => setResult(parsed))
      }
    } catch { /* A file can still be loaded when browser storage is unavailable. */ }
  }, [])
  async function loadFile(file?: File) {
    if (!file) return
    setError('')
    try {
      const next = specialExportContacts(await file.text())
      setResult(next)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) }
      catch { setError('Special Export is ready, but could not be saved in this browser. Download it before leaving.') }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to read CSV') }
  }
  function download() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([specialExportCsv(result.contacts)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'special-export.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="migration-panel" style={{ marginBottom: 24 }} aria-labelledby="special-export-title">
    <div className="migration-panel-heading"><div><span className="migration-eyebrow">Missing contacts from Bigin import</span><h2 id="special-export-title">Special Export</h2></div></div>
    <div className="migration-controls">
      <p>Load Bigin's skipped-records CSV to export contacts whose Email lookup was not found. Format: Name, Phone, Email. Repeated phone numbers are removed. Import these contacts before retrying the skipped deals.</p>
      <label className="migration-select">Skipped-records CSV<input type="file" accept=".csv,text/csv" onChange={event => { void loadFile(event.target.files?.[0]); event.target.value = '' }} /></label>
      {result && <><p role="status">{result.contacts.length.toLocaleString()} unique contacts from {result.matched.toLocaleString()} missing-email errors. {result.duplicates} repeated contacts removed; {result.excluded} excluded without name/phone.</p><button disabled={!result.contacts.length} onClick={download}>Download Special Export</button></>}
      {error && <p role="alert" className="migration-error">{error}</p>}
    </div>
  </section>
}
