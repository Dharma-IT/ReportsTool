import BiginRefundsReport from './BiginRefundsReport'
import BiginProductChart from './BiginProductChart'
import { useEffect, useMemo, useState } from 'react'
import type { BiginItem, BiginTransaction } from '../../api/_lib/bigin-transactions'
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const columns: { key: keyof BiginItem; label: string }[] = [
  { key: 'paidDate', label: 'Paid date' }, { key: 'name', label: 'Name' }, { key: 'unitPrice', label: 'Unit price' }, { key: 'quantity', label: 'Quantity' },
  { key: 'discount', label: 'Total discount' }, { key: 'installmentFee', label: 'Installment fee (deal)' }, { key: 'amount', label: 'Amount (deal)' },
  { key: 'dealName', label: 'Deal name' }, { key: 'owner', label: 'Deal owner' },
]
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || ''
export default function BiginItemsReport({ rows, range, reportLoading }: { rows: BiginTransaction[]; range: { from: string; to: string } | null; reportLoading: boolean }) {
  const [items, setItems] = useState<BiginItem[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [missing, setMissing] = useState(0)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: keyof BiginItem; direction: number }>({ key: 'paidDate', direction: -1 })
  useEffect(() => {
    const controller = new AbortController()
    setItems([]); setMissing(0); setError(''); setPage(1); setProgress(0)
    if (!range || !rows.length) { setLoading(false); return () => controller.abort() }
    setLoading(true)
    async function load() {
      const collected: BiginItem[] = []
      let missingCount = 0
      try {
        for (let index = 0; index < rows.length; index += 20) {
          const ids = rows.slice(index, index + 20).map(row => row.id).join(',')
          const base = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : apiBase
          const response = await fetch(`${base}/api/bigin-items?${new URLSearchParams({ ids })}`, { signal: controller.signal })
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The Bigin items API is unavailable. Deploy the updated server and try again.')
          const data = await response.json() as { items: BiginItem[]; missingProducts: number; message?: string }
          if (!response.ok) throw new Error(data.message || 'Unable to load item details.')
          collected.push(...data.items.filter(item => item.paidDate >= range!.from && item.paidDate <= range!.to))
          missingCount += data.missingProducts
          if (controller.signal.aborted) return
          setProgress(Math.min(index + 20, rows.length))
        }
        if (!controller.signal.aborted) { setItems(collected); setMissing(missingCount) }
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load items.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [rows, range, retry])
  const sorted = useMemo(() => [...items].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key]
    if (left === null) return right === null ? 0 : 1
    if (right === null) return -1
    return (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))) * sort.direction || a.id.localeCompare(b.id)
  }), [items, sort])
  const pages = Math.max(1, Math.ceil(items.length / 50))
  function value(item: BiginItem, key: keyof BiginItem) {
    const field = item[key]
    if (field === null || field === '') return <span className="bigin-unavailable" aria-label="Not available">&mdash;</span>
    if (['unitPrice', 'discount', 'installmentFee', 'amount'].includes(key)) return money.format(Number(field))
    if (key === 'dealName') return <a className="bigin-deal-link" href={`https://bigin.zoho.com/bigin/org945767910/Home#/deals/${encodeURIComponent(item.dealId)}?section=notes`} target="_blank" rel="noopener noreferrer">{field}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></svg></a>
    if (key === 'name') return <><strong>{field}</strong>{item.source === 'Product field only' && <small>Product field only</small>}</>
    return field
  }
  return <><section className="bigin-table-card bigin-items-card" aria-labelledby="bigin-items-title">
    <div className="bigin-table-heading"><div><h2 id="bigin-items-title">Items Report <span className="bigin-items-tag">Finance</span></h2><p className="bigin-items-description">Product details from both pipelines / same paid date filter.</p></div><span>{!loading && range && !error ? `${items.length.toLocaleString()} item rows / USD` : 'USD'}</span></div>
    {reportLoading || loading ? <p className="bigin-empty" role="status">{reportLoading ? 'Waiting for paid transactions...' : `Loading product details: ${progress} of ${rows.length} deals.`}</p> : error ? <div className="bigin-items-error" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Retry item report</button></div> : !range ? <p className="bigin-empty">Apply your paid date range to view item details.</p> : <>
      <p className="bigin-items-note">Deal amount and installment fee repeat for each product; do not sum these columns. Blank item details are unavailable in Bigin.{missing > 0 && ` ${missing} paid ${missing === 1 ? 'deal has' : 'deals have'} no product recorded.`}</p>
      {!items.length ? <p className="bigin-empty">No product items were recorded for these paid deals.</p> : <>
        <div className="bigin-table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key} aria-sort={sort.key === column.key ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => { setSort({ key: column.key, direction: sort.key === column.key ? -sort.direction : 1 }); setPage(1) }}>{column.label}<svg className="bigin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={sort.key === column.key ? sort.direction === 1 ? 'M12 20V4m-6 6 6-6 6 6' : 'M12 4v16m-6-6 6 6 6-6' : 'M8 3v14m-4-4 4 4 4-4M16 21V7m-4 4 4-4 4 4'} /></svg></button></th>)}</tr></thead><tbody>{sorted.slice((page - 1) * 50, page * 50).map(item => <tr key={item.id}>{columns.map(column => <td key={column.key}>{value(item, column.key)}</td>)}</tr>)}</tbody></table></div>
        <footer className="bigin-pagination"><span>{(page - 1) * 50 + 1} to {Math.min(page * 50, items.length)} of {items.length.toLocaleString()}</span><div><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button></div></footer>
      </>}
    </>}
  </section>
    <BiginRefundsReport range={range} reportLoading={reportLoading} />
    <BiginProductChart items={items} loading={loading || reportLoading} error={error} hasRange={Boolean(range)} />
  </>
}
