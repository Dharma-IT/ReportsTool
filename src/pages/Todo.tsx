import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './Todo.css'

type Item = { id: string; title: string; completed: boolean }
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mutation = useRef(false)
  const revision = useRef(0)
  const pendingAddId = useRef<string | null>(null)
  const completed = items.filter(item => item.completed).length
  async function refresh() {
    const started = revision.current
    try {
      const result = await request()
      if (started === revision.current && !mutation.current) { setItems(result.items ?? []); setLoading(false); setError('') }
    } catch (failure) {
      if (started === revision.current) { setError(failure instanceof Error ? failure.message : 'Unable to load checklist'); setLoading(false) }
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
      } catch (failure) {
        if (active && started === revision.current) { setError(failure instanceof Error ? failure.message : 'Unable to load checklist'); setLoading(false) }
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
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save checklist. Retry.'); return false }
    finally { revision.current++; mutation.current = false; setSaving(false) }
  }
  async function add(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || mutation.current) return
    pendingAddId.current ??= crypto.randomUUID()
    if (await update('POST', { id: pendingAddId.current, title: title.trim() }, 'Checklist item added for everyone.')) { setTitle(''); pendingAddId.current = null }
  }
  return <main className="todo-page">
    <header className="todo-heading"><span>Migration checklist</span><h1>Things to do</h1><p>A shared checklist for the move to Bigin. Anyone with this link can add items and check off completed work.</p></header>
    <section className="todo-card" aria-labelledby="todo-list-title">
      <div className="todo-card-heading"><div><h2 id="todo-list-title">Our checklist</h2><p>{loading ? 'Loading shared checklist...' : `${completed} of ${items.length} completed`}</p></div><span className="todo-shared">Shared with everyone</span></div>
      <progress aria-label="Checklist completion" value={completed} max={Math.max(items.length, 1)} />
      {loading ? <p className="todo-empty" role="status">Loading items...</p> : items.length ? <ul className="todo-list">{items.map(item => <li key={item.id} className={item.completed ? 'is-complete' : ''}><label><input type="checkbox" checked={item.completed} disabled={saving} onChange={event => { const checked = event.target.checked; setItems(previous => previous.map(row => row.id === item.id ? { ...row, completed: checked } : row)); void update('PATCH', { id: item.id, completed: checked }, 'Checklist updated for everyone.').then(saved => { if (!saved) setItems(previous => previous.map(row => row.id === item.id ? { ...row, completed: item.completed } : row)) }) }} /><span>{item.title}</span></label><span className="todo-item-status" aria-hidden="true">{item.completed ? 'Done' : 'To do'}</span></li>)}</ul> : <p className="todo-empty">No items yet. Add the first one below.</p>}
      <form className="todo-add" onSubmit={event => { void add(event) }}><label htmlFor="new-todo">Add a checklist item</label><div><input id="new-todo" value={title} onChange={event => { setTitle(event.target.value); pendingAddId.current = null }} maxLength={200} placeholder="What else needs to be done?" disabled={saving || loading} required /><button type="submit" disabled={saving || loading || !title.trim()}>{saving ? 'Saving...' : 'Add item'}</button></div></form>
      <div className="todo-feedback" aria-live="polite">{error ? <div role="alert"><p>{error}</p><button disabled={saving} onClick={() => void refresh()}>Retry loading</button></div> : <p>{saving ? 'Saving shared changes...' : notice || 'Changes are saved for everyone. This page refreshes every 10 seconds.'}</p>}</div>
    </section>
  </main>
}
