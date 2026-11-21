import { useEffect, useMemo, useState } from 'react'
import type { BiginTransaction } from '../../api/_lib/bigin-transactions'
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || ''
const columns: {key: keyof BiginTransaction; label: string}[] = [{key:'paidDate',label:'Paid date'},{key:'owner',label:'Deal owner'},{key:'dealName',label:'Deal name'},{key:'amount',label:'Recorded amount'},{key:'contact',label:'Contact name'},{key:'phone',label:'Phone number'},{key:'pipeline',label:'Pipeline'}]
export default function BiginRefundsReport({range,reportLoading}:{range:{from:string;to:string}|null;reportLoading:boolean}) {
  const [rows,setRows]=useState<BiginTransaction[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [retry,setRetry]=useState(0)
  const [page,setPage]=useState(1)
  const [sort,setSort]=useState<{key:keyof BiginTransaction;direction:number}>({key:'paidDate',direction:-1})
  useEffect(()=>{
    const controller=new AbortController()
    setRows([]);setError('');setPage(1)
    if(!range){setLoading(false);return()=>controller.abort()}
    setLoading(true)
    async function load(){
      const collected=new Map<string,BiginTransaction>()
      async function fetchRange(pipeline:string,from:string,to:string):Promise<void>{
        for(let page=1;page<=10;page++){
          const base=['localhost','127.0.0.1'].includes(window.location.hostname)?'':configuredBase
          const response=await fetch(`${base}/api/bigin-transactions?${new URLSearchParams({from,to,pipeline,page:String(page),report:'refunds'})}`,{signal:controller.signal})
          if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('The Bigin refunds API is unavailable. Deploy the updated server and try again.')
          const data=await response.json() as {rows:BiginTransaction[];more:boolean;message?:string}
          if(!response.ok){
            if(data.message?.includes('2,000-record')&&from<to){
              const start=Date.parse(`${from}T00:00:00Z`),end=Date.parse(`${to}T00:00:00Z`)
              const mid=start+Math.floor((end-start)/86400000/2)*86400000
              await fetchRange(pipeline,from,new Date(mid).toISOString().slice(0,10))
              await fetchRange(pipeline,new Date(mid+86400000).toISOString().slice(0,10),to)
              return
            }
            throw new Error(data.message||'Unable to load refunds.')
          }
          for(const row of data.rows)collected.set(row.id,row)
          if(!data.more)break
        }
      }
      try{
        for(const pipeline of ['New Leads','Customer Service'])await fetchRange(pipeline,range!.from,range!.to)
        if(!controller.signal.aborted)setRows([...collected.values()])
      }catch(failure){if(!controller.signal.aborted)setError(failure instanceof Error?failure.message:'Unable to load refunds.')}
      finally{if(!controller.signal.aborted)setLoading(false)}
    }
    void load();return()=>controller.abort()
  },[range,retry])
  const sorted=useMemo(()=>[...rows].sort((a,b)=>{
    const left=a[sort.key]??'',right=b[sort.key]??''
    return (typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right)))*sort.direction||a.id.localeCompare(b.id)
  }),[rows,sort])
  const pages=Math.max(1,Math.ceil(rows.length/50))
  return <section className="bigin-table-card bigin-refunds-card" aria-labelledby="bigin-refunds-title">
    <div className="bigin-table-heading"><div><h2 id="bigin-refunds-title">Refunds</h2><p className="bigin-items-description">Refund stage / both pipelines / selected Paid Date range.</p></div><span>{range&&!loading&&!error?`${rows.length} refunded deals / USD`:'USD'}</span></div>
    {reportLoading||loading?<p role="status" className="bigin-empty">Loading refunded deals...</p>:error?<div role="alert" className="bigin-items-error"><p>{error}</p><button onClick={()=>setRetry(r=>r+1)}>Retry refunds</button></div>:!range?<p className="bigin-empty">Apply your paid date range to view refunds.</p>:!rows.length?<p className="bigin-empty">No deals in the Refund stage have a Paid Date in this range.</p>:<>
      <div className="bigin-table-scroll"><table><thead><tr>{columns.map(column=><th key={column.key} aria-sort={sort.key===column.key?sort.direction===1?'ascending':'descending':'none'}><button onClick={()=>{setSort({key:column.key,direction:sort.key===column.key?-sort.direction:1});setPage(1)}}>{column.label}<svg className="bigin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={sort.key===column.key?sort.direction===1?'M12 20V4m-6 6 6-6 6 6':'M12 4v16m-6-6 6 6 6-6':'M8 3v14m-4-4 4 4 4-4M16 21V7m-4 4 4-4 4 4'}/></svg></button></th>)}</tr></thead><tbody>{sorted.slice((page-1)*50,page*50).map(row=><tr key={row.id}>{columns.map(column=><td key={column.key}>{column.key==='amount'?money.format(row.amount):column.key==='dealName'?<a className="bigin-deal-link" href={`https://bigin.zoho.com/bigin/org945767910/Home#/deals/${encodeURIComponent(row.id)}?section=notes`} target="_blank" rel="noopener noreferrer">{row.dealName}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg></a>:row[column.key]||'Not provided'}</td>)}</tr>)}</tbody></table></div>
      <footer className="bigin-pagination"><span>{(page-1)*50+1} to {Math.min(page*50,rows.length)} of {rows.length}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Next</button></div></footer>
    </>}
  </section>
}
