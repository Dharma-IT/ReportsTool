import { useEffect, useRef, useState } from 'react'

type Frame = { image?: string; width?: number; height?: number; connected?: boolean; message?: string }

export default function StripeOnlineConnection({ apiUrl }: { apiUrl: (path: string) => string }) {
  const [open, setOpen] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [text, setText] = useState('')
  const [frame, setFrame] = useState<Frame>({})
  const [active, setActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const response = await fetch(apiUrl('/api/stripe-online'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ action, ...extra }),
      })
      const result = await response.json() as Frame
      if (!response.ok) throw new Error(result.message || 'Online Stripe request failed.')
      if (result.image) setFrame(result)
      if (action === 'start') { setActive(true); setMessage('Click a field in the Stripe view, then use the text box to enter its value. Complete login and MFA, then save.') }
      if (action === 'save') { setActive(false); setFrame({}); setMessage('Online Stripe session saved. Close this window and click Apply to recover phone numbers.'); setAdminKey('') }
      if (action === 'close') { setActive(false); setFrame({}); setAdminKey(''); setText(''); setOpen(false) }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Online Stripe request failed.') }
    finally { locked.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (!open || !active) return
    const timer = window.setInterval(() => { void call('frame') }, 2000)
    return () => window.clearInterval(timer)
    // The key is kept only in this component's memory for this login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, adminKey])

  return <>
    <button type="button" onClick={() => setOpen(true)}>Connect Stripe online</button>
    {open && <div className="stripe-online-overlay"><section className="stripe-online-dialog" role="dialog" aria-modal="true" aria-labelledby="stripe-online-title">
      <h2 id="stripe-online-title">Online Stripe connection</h2>
      <p>This saves a separate session on Render. Your local Stripe session is independent.</p>
      {!active && <form onSubmit={event => { event.preventDefault(); void call('start') }}>
        <label>Online administrator key <input autoFocus type="password" autoComplete="off" value={adminKey} onChange={event => setAdminKey(event.target.value)} /></label>
        <button disabled={busy || !adminKey}>Open Stripe login</button>
      </form>}
      <p role="status">{message}</p>
      {active && <>
        <div className="stripe-online-controls">
          <form onSubmit={event => { event.preventDefault(); const value = text; setText(''); void call('text', { text: value }) }}>
            <label>Text for selected Stripe field <input type="password" autoComplete="off" value={text} onChange={event => setText(event.target.value)} /></label>
            <button disabled={busy || !text}>Send text</button>
          </form>
          {['Tab', 'Enter', 'Backspace', 'Control+A'].map(key => <button key={key} disabled={busy} onClick={() => void call('key', { key })}>{key === 'Control+A' ? 'Select all' : key}</button>)}
          <button disabled={busy} onClick={() => void call('scroll', { direction: 'up' })}>Scroll up</button>
          <button disabled={busy} onClick={() => void call('scroll', { direction: 'down' })}>Scroll down</button>
          <button disabled={busy} onClick={() => void call('frame')}>Refresh view</button>
          <button disabled={busy} onClick={() => void call('save')}>Save online session</button>
        </div>
        {frame.image ? <img className="stripe-online-frame" src={frame.image} alt="Interactive Stripe login on Render. Click a field, then send text using the controls above." onClick={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          void call('click', { x: (event.clientX - bounds.left) * (frame.width || 1100) / bounds.width, y: (event.clientY - bounds.top) * (frame.height || 760) / bounds.height })
        }} /> : <p>Loading Stripe view…</p>}
      </>}
      <button disabled={busy} onClick={() => { if (active) void call('close'); else { setOpen(false); setAdminKey(''); setText(''); setFrame({}) } }}>Close</button>
      <small>Login closes after 10 minutes of inactivity. You may need an authenticator code; device-bound passkeys cannot be used through this view.</small>
    </section></div>}
  </>
}
