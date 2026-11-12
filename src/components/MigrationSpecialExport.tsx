import { useEffect, useState } from 'react'
import { specialExportContacts, specialExportCsv, skippedPipelineRows } from '../lib/migration-special-export.js'
import { dealCsv } from '../lib/migration-deal-csv.js'
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
      const text = await file.text()
      const next = { ...specialExportContacts(text), pipelineRows: skippedPipelineRows(text), sourceName: file.name }
      setResult(next)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) }
      catch { setError('Exports are ready, but could not be saved in this browser. Download them before leaving.') }
    } catch (failure) { setResult(null); setError(failure instanceof Error ? failure.message : 'Unable to read CSV') }
  }
  function download() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([specialExportCsv(result.contacts)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'special-export.csv'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function downloadSkipped(batchIndex: number) {
    if (!result?.pipelineRows) return
    const rows = result.pipelineRows.slice(batchIndex * 10000, (batchIndex + 1) * 10000)
    const url = URL.createObjectURL(new Blob([dealCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `skipped-export-${batchIndex + 1}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="migration-panel" style={{ marginBottom: 24 }} aria-labelledby="special-export-title">
    <div className="migration-panel-heading"><div><span className="migration-eyebrow">Missing contacts from Bigin import</span><h2 id="special-export-title">Special Export</h2></div></div>
    <div className="migration-controls">
      <p>Load Bigin's skipped-records CSV. First import missing contacts with Special Export, then retry the skipped pipeline deals using Skipped Exports below.</p>
      <label className="migration-select">Skipped-records CSV<input type="file" accept=".csv,text/csv" onChange={event => { void loadFile(event.target.files?.[0]); event.target.value = '' }} /></label>
      {result && <><p role="status">{result.contacts.length.toLocaleString()} unique contacts from {result.matched.toLocaleString()} missing-email errors. {result.duplicates} repeated contacts removed; {result.excluded} excluded without name/phone.</p><button disabled={!result.contacts.length} onClick={download}>Download Special Export</button></>}
      {result && <section className="migration-skipped-exports" aria-labelledby="skipped-export-title">
        <h3 id="skipped-export-title">Skipped Exports</h3>
        {result.pipelineRows ? <>
          <p>{result.pipelineRows.length.toLocaleString()} skipped deals from {result.sourceName || 'the uploaded file'}. Includes every row with an error, with repeat purchases kept. Stage mappings, dummy emails, owner defaults, and date defaults are applied when downloading.</p>
          <p>After importing the missing contacts into Bigin, import these files into the corresponding pipeline. Each file contains up to 10,000 skipped deals.</p>
          <div className="migration-actions">{Array.from({ length: Math.ceil(result.pipelineRows.length / 10000) }, (_, index) => <button key={index} onClick={() => downloadSkipped(index)}>Download Skipped Export {index + 1} ({Math.min(10000, result.pipelineRows!.length - index * 10000).toLocaleString()} deals)</button>)}</div>
          {result.pipelineRows.length === 0 && <p>No skipped deals found in this file.</p>}
        </> : <p>Upload the skipped-records CSV again to create pipeline retry files from your previously saved Special Export.</p>}
      </section>}
      {error && <p role="alert" className="migration-error">{error}</p>}
    </div>
  </section>
}
