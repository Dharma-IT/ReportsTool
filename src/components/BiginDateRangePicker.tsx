import { useEffect, useRef, useState } from 'react'
import { biginDatePresets, biginPresetRange } from '../lib/bigin-date-presets.js'
import './BiginDateRangePicker.css'
type Dates = {from:string;to:string}
const easternToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const iso = (date:Date) => date.toISOString().slice(0,10)
function Chevron({left=false}:{left?:boolean}) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={left?'m15 6-6 6 6 6':'m9 6 6 6-6 6'}/></svg> }
function CalendarIcon(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>}
export default function BiginDateRangePicker({from,to,disabled,onApply}:{from:string;to:string;disabled:boolean;onApply:(dates:Dates)=>void}){
  const [open,setOpen]=useState(false)
  const [draft,setDraft]=useState<Dates>({from,to})
  const [preset,setPreset]=useState('')
  const [appliedPreset,setAppliedPreset]=useState('')
  const [pickingEnd,setPickingEnd]=useState(false)
  const [month,setMonth]=useState(()=>easternToday().slice(0,7)+'-01')
  const wrapper=useRef<HTMLDivElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  const valid = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&iso(new Date(value))===value
  const canApply=valid(draft.from)&&valid(draft.to)&&draft.from<=draft.to
  function show(){setDraft({from,to});setPreset(appliedPreset);setPickingEnd(false);setMonth((from.startsWith('0001')?easternToday():from).slice(0,7)+'-01');setOpen(true)}
  function close(){setOpen(false);trigger.current?.focus()}
  useEffect(()=>{
    if(!open)return
    function outside(event:PointerEvent){if(!wrapper.current?.contains(event.target as Node))setOpen(false)}
    function escape(event:KeyboardEvent){if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[open])
  function moveMonth(delta:number){const date=new Date(month+'T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);if(date.getUTCFullYear()>=1&&date.getUTCFullYear()<=9998)setMonth(iso(date))}
  function pick(value:string){setPreset('');if(!pickingEnd){setDraft({from:value,to:value});setPickingEnd(true)}else{setDraft({from:value<draft.from?value:draft.from,to:value<draft.from?draft.from:value});setPickingEnd(false)}}
  return <div className={`bigin-date-picker${open?' is-open':''}`} ref={wrapper}>
    <div className="bigin-date-controls">
      <button className="bigin-range-trigger" ref={trigger} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls="bigin-date-popover" onClick={()=>open?close():show()}><CalendarIcon/>{appliedPreset||'Date range'}<span className="bigin-range-chevron"><Chevron/></span></button>
      <button className="bigin-date-display" type="button" disabled={disabled} onClick={show} aria-label="Open paid date from calendar"><span>Paid date from</span><strong>{from==='0001-01-01'?'All time':from}<CalendarIcon/></strong></button>
      <button className="bigin-date-display" type="button" disabled={disabled} onClick={show} aria-label="Open paid date to calendar"><span>Paid date to</span><strong>{to}<CalendarIcon/></strong></button>
    </div>
    {open&&<div className="bigin-date-popover" id="bigin-date-popover" role="dialog" aria-label="Paid date range picker">
      <aside className="bigin-preset-sidebar"><h3>Date ranges</h3><div role="group" aria-label="Date presets">{biginDatePresets.map(label=><button type="button" key={label} aria-pressed={preset===label} onClick={()=>{const dates=biginPresetRange(label,easternToday());setDraft(dates);setPreset(label);setPickingEnd(false);setMonth((label==='All time'?easternToday():dates.from).slice(0,7)+'-01')}}>{label}</button>)}</div></aside>
      <div className="bigin-calendar-area">
        <div className="bigin-calendar-inputs"><label>From<input type="text" inputMode="numeric" aria-label="Paid date from" placeholder="YYYY-MM-DD" value={draft.from} onChange={e=>{setDraft({...draft,from:e.target.value});setPreset('')}}/></label><label>To<input type="text" inputMode="numeric" aria-label="Paid date to" placeholder="YYYY-MM-DD" value={draft.to} onChange={e=>{setDraft({...draft,to:e.target.value});setPreset('')}}/></label><button type="button" className="bigin-date-close" aria-label="Close date picker" onClick={close}>&times;</button></div>
        <div className="bigin-calendar-nav"><button type="button" aria-label="Previous month" onClick={()=>moveMonth(-1)}><Chevron left/></button><span>{preset==='Last 7 Days'?'Last 7 days, excluding today':pickingEnd?'Choose an end date':'Choose your date range'}</span><button type="button" aria-label="Next month" onClick={()=>moveMonth(1)}><Chevron/></button></div>
        <div className="bigin-calendars">{[0,1].map(offset=>{
          const first=new Date(month+'T00:00:00Z');first.setUTCMonth(first.getUTCMonth()+offset)
          const title=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(first)
          const last=new Date(first);last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0)
          return <section className="bigin-calendar" key={offset} aria-label={title}><h4>{title}</h4><div className="bigin-calendar-grid">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><span className="bigin-weekday" key={day}>{day}</span>)}{Array.from({length:first.getUTCDay()},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:last.getUTCDate()},(_,i)=>{
            const date=new Date(first);date.setUTCDate(i+1);const value=iso(date),endpoint=value===draft.from||value===draft.to,inside=value>draft.from&&value<draft.to
            return <button type="button" key={value} aria-label={value} aria-pressed={endpoint} aria-current={value===easternToday()?'date':undefined} className={`${endpoint?'is-endpoint ':''}${inside?'is-in-range':''}`} onClick={()=>pick(value)}>{i+1}</button>
          })}</div></section>
        })}</div>
      </div>
      <footer className="bigin-date-footer"><span>{preset==='All time'?'All recorded dates':canApply?`${draft.from} to ${draft.to}`:'Enter a valid date range'}</span><button type="button" className="bigin-date-cancel" onClick={close}>Cancel</button><button type="button" className="bigin-date-apply" disabled={!canApply} onClick={()=>{setAppliedPreset(preset);onApply(draft);close()}}>Apply</button></footer>
    </div>}
  </div>
}
