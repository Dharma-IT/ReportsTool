import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './Todo.css'

type Item = { id: string; title: string; completed: boolean; parent_id?: string | null }
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
async function request(method = 'GET', body?: object): Promise<{ items?: Item[] }> {
  const response = await fetch(`${apiBase}/api/todo`, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Checklist API unavailable. Please retry after the server updates.')
  const result = await response.json()
  if (!response.ok) throw new Error(result.message ?? 'Unable to save checklist')
  return result
}
export default function Todo() {
  const [items, setItems] = useState<Item[]>([])
  const [title, setTitle] = useState('')
  const [parentId, setParentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mutation = useRef(false)
  const revision = useRef(0)
  const pendingAddId = useRef<string | null>(null)
  const dragged = useRef<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null)
  const completed = items.filter(item => item.completed).length
  const rootItems = items.filter(item => !item.parent_id)
  async function refresh() {
    const started = revision.current
    try {
      const result = await request()
      if (started === revision.current && !mutation.current) { setItems(result.items ?? []); setLoading(false); setError('') }
    } catch {
      if (started === revision.current) { setNotice('Loading checklist updates... Retrying automatically.'); setError('') }
    }
  }
  useEffect(() => {
    let active = true
    const poll = async () => {
      if (mutation.current) return
      const started = revision.current
      try {
        const result = await request()
        if (active && started === revision.current && !mutation.current) { setItems(result.items ?? []); setLoading(false); setError('') }
      } catch {
        if (active && started === revision.current) { setNotice('Loading checklist updates... Retrying automatically.') }
      }
    }
    void poll()
    const timer = window.setInterval(() => { if (!document.hidden) void poll() }, 10000)
    const focus = () => { void poll() }
    window.addEventListener('focus', focus)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [])
  async function update(method: string, body: object, success: string) {
    if (mutation.current) return false
    mutation.current = true
    revision.current++
    setSaving(true); setError(''); setNotice('')
    try {
      await request(method, body)
      const result = await request()
      setItems(result.items ?? [])
      setNotice(success)
      return true
    } catch { setError('Your change could not be saved. Please try again.'); return false }
    finally { revision.current++; mutation.current = false; setSaving(false) }
  }
  async function add(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || mutation.current) return
    pendingAddId.current ??= crypto.randomUUID()
    if (await update('POST', { id: pendingAddId.current, title: title.trim(), parentId: parentId || null }, 'Checklist item added for everyone.')) { setTitle(''); pendingAddId.current = null }
  }
  async function move(id: string, targetId: string, after: boolean) {
    if (mutation.current || id === targetId) return
    const previous = items
    const item = items.find(row => row.id === id)
    if (!item) return
    const reordered = items.filter(row => row.id !== id)
    const target = reordered.findIndex(row => row.id === targetId)
    if (target < 0) return
    reordered.splice(target + (after ? 1 : 0), 0, item)
    setItems(reordered)
    if (!await update('PATCH', { action: 'move', id, targetId, after }, 'Checklist order saved for everyone.')) setItems(previous)
  }
  async function toggleChild(item: Item, checked: boolean) {
    setItems(previous => previous.map(row => row.id === item.id ? { ...row, completed: checked } : row))
    if (!await update('PATCH', { id: item.id, completed: checked }, 'Checklist updated for everyone.')) {
      setItems(previous => previous.map(row => row.id === item.id ? { ...row, completed: item.completed } : row))
    }
  }
  return <main className="todo-page">
    <header className="todo-heading">
      <div className="todo-illustration" aria-hidden="true">
        <svg viewBox="0 0 96 96" fill="none">
          <g className="todo-paper"><rect x="19" y="13" width="58" height="72" rx="9" fill="#fffdf5" stroke="currentColor" strokeWidth="2" /><rect x="35" y="8" width="26" height="12" rx="4" fill="#e9eedb" stroke="currentColor" strokeWidth="2" /><path d="M43 37h22M43 53h22M43 69h14" stroke="#c0cba9" strokeWidth="3" strokeLinecap="round" /><path className="todo-drawn-check" d="m28 36 4 4 6-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><rect x="28" y="49" width="8" height="8" rx="2" stroke="#c0cba9" strokeWidth="2" /><rect x="28" y="65" width="8" height="8" rx="2" stroke="#c0cba9" strokeWidth="2" /></g>
          <g className="todo-moving-pen"><path d="m59 59 18-31a4 4 0 0 1 7 4L66 63l-9 7 2-11Z" fill="#e9c76b" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m74 34 7 4M59 59l7 4M57 70l3-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></g>
        </svg>
      </div>
      <span>Migration checklist</span><h1>Things to do</h1><p>A shared checklist for the move to Bigin. Anyone with this link can add items and check off completed work.</p>
    </header>
    <section className="todo-card" aria-labelledby="todo-list-title">
      <div className="todo-card-heading"><div><h2 id="todo-list-title">Our checklist</h2><p>{loading ? 'Loading shared checklist...' : `${completed} of ${items.length} completed`}</p></div><span className="todo-shared">Shared with everyone</span></div>
      <progress aria-label="Checklist completion" value={completed} max={Math.max(items.length, 1)} />
      {loading ? <p className="todo-empty" role="status">Loading items...</p> : items.length ? <>
        <p className="todo-reorder-hint">Drag the handle to reorder, or use the up and down arrows.</p>
        <ul className="todo-list">{rootItems.map((item, index) => <li key={item.id}
          className={`${item.completed ? 'is-complete' : ''} ${dropTarget?.id === item.id ? dropTarget.after ? 'todo-drop-after' : 'todo-drop-before' : ''}`}
          onDragOver={event => { if (!dragged.current || saving) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const bounds = event.currentTarget.getBoundingClientRect(); setDropTarget({ id: item.id, after: event.clientY > bounds.top + bounds.height / 2 }) }}
          onDrop={event => { event.preventDefault(); const id = dragged.current; const bounds = event.currentTarget.getBoundingClientRect(); const after = event.clientY > bounds.top + bounds.height / 2; dragged.current = null; setDropTarget(null); if (id) void move(id, item.id, after) }}>
          <button type="button" className="todo-drag-handle" aria-label={`Drag ${item.title} to reorder`} title="Drag to reorder. Use arrow keys, Home, or End to move." draggable={!saving} disabled={saving}
            onDragStart={event => { dragged.current = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }}
            onDragEnd={() => { dragged.current = null; setDropTarget(null) }}
            onKeyDown={event => { const target = event.key === 'ArrowUp' ? rootItems[index - 1] : event.key === 'ArrowDown' ? rootItems[index + 1] : event.key === 'Home' ? rootItems[0] : event.key === 'End' ? rootItems[rootItems.length - 1] : null; if (target) { event.preventDefault(); void move(item.id, target.id, event.key === 'ArrowDown' || event.key === 'End') } }}><span aria-hidden="true">⠿</span></button>
          <label><input type="checkbox" checked={item.completed} disabled={saving} onChange={event => { const checked = event.target.checked; setItems(previous => previous.map(row => row.id === item.id ? { ...row, completed: checked } : row)); void update('PATCH', { id: item.id, completed: checked }, 'Checklist updated for everyone.').then(saved => { if (!saved) setItems(previous => previous.map(row => row.id === item.id ? { ...row, completed: item.completed } : row)) }) }} /><span>{item.title}</span></label>
          <span className="todo-item-status" aria-hidden="true">{item.completed ? 'Done' : 'To do'}</span>
          <div className="todo-move-buttons"><button type="button" aria-label={`Move ${item.title} up`} disabled={saving || index === 0} onClick={() => void move(item.id, rootItems[index - 1].id, false)}>↑</button><button type="button" aria-label={`Move ${item.title} down`} disabled={saving || index === rootItems.length - 1} onClick={() => void move(item.id, rootItems[index + 1].id, true)}>↓</button></div>
          {items.some(child => child.parent_id === item.id) && <div className="todo-subchecklist"><p>{items.filter(child => child.parent_id === item.id && child.completed).length} of {items.filter(child => child.parent_id === item.id).length} sub-items completed</p><ul aria-label={`${item.title} sub-checklist`}>{items.filter(child => child.parent_id === item.id).map(child => <li key={child.id} className={child.completed ? 'is-complete' : ''}><label><input type="checkbox" checked={child.completed} disabled={saving} onChange={event => { void toggleChild(child, event.target.checked) }} /><span>{child.title}</span></label><span className="todo-item-status">{child.completed ? 'Done' : 'To do'}</span></li>)}</ul></div>}
        </li>)}</ul>
      </> : <p className="todo-empty">No items yet. Add the first one below.</p>}
      <form className="todo-add" onSubmit={event => { void add(event) }}><label htmlFor="new-todo">Add a checklist item</label><label className="todo-parent-label" htmlFor="todo-parent">Add under<select id="todo-parent" value={parentId} disabled={saving || loading} onChange={event => { setParentId(event.target.value); pendingAddId.current = null }}><option value="">Main checklist</option>{rootItems.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div><input id="new-todo" value={title} onChange={event => { setTitle(event.target.value); pendingAddId.current = null }} maxLength={200} placeholder="What else needs to be done?" disabled={saving || loading} required /><button type="submit" disabled={saving || loading || !title.trim()}>{saving ? 'Saving...' : 'Add item'}</button></div></form>
      <div className="todo-feedback" aria-live="polite">{error ? <div role="alert"><p>{error}</p><button disabled={saving} onClick={() => void refresh()}>Retry loading</button></div> : <p>{saving ? 'Saving shared changes...' : loading ? 'Loading checklist... Retrying automatically.' : notice || 'Changes are saved for everyone. This page refreshes every 10 seconds.'}</p>}</div>
    </section>
  </main>
}
