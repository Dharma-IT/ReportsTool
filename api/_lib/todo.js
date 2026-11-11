export function validateTodo(method, body) {
  if (!body || typeof body !== 'object' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id ?? '')) throw Object.assign(new Error('A valid checklist item ID is required.'), { status: 400 })
  if (method === 'POST') {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 200) throw Object.assign(new Error('Enter a checklist item with 1 to 200 characters.'), { status: 400 })
    if (body.parentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.parentId)) throw Object.assign(new Error('Choose a valid parent checklist.'), { status: 400 })
    return { id: body.id, title, completed: false, parent_id: body.parentId || null }
  }
  if (body.action === 'move') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.targetId ?? '') || typeof body.after !== 'boolean') throw Object.assign(new Error('Choose a valid move destination.'), { status: 400 })
    return { p_id: body.id, p_target: body.targetId, p_after: body.after }
  }
  if (typeof body.completed !== 'boolean') throw Object.assign(new Error('Completed must be true or false.'), { status: 400 })
  return { completed: body.completed, updated_at: new Date().toISOString() }
}
export async function todoRequest(method, body, env = process.env) {
  if (!['GET', 'POST', 'PATCH'].includes(method)) throw Object.assign(new Error('Method not allowed'), { status: 405 })
  const value = method === 'GET' ? undefined : validateTodo(method, body)
  const base = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Shared checklist storage is not configured on the server.')
  const rest = base.endsWith('/rest/v1') ? base : `${base}/rest/v1`
  const moving = method === 'PATCH' && body.action === 'move'
  const query = method === 'GET' ? '?select=id,title,completed,parent_id,created_at,updated_at&order=sort_order.asc,created_at.asc,id.asc' : method === 'PATCH' ? `?id=eq.${encodeURIComponent(body.id)}` : '?on_conflict=id'
  const response = await fetch(moving ? `${rest}/rpc/move_migration_todo` : `${rest}/migration_todo_items${query}`, {
    method: moving ? 'POST' : method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: method === 'POST' ? 'resolution=ignore-duplicates,return=representation' : 'return=representation' },
    ...(value ? { body: JSON.stringify(value) } : {}),
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error('Unable to save or load the shared checklist. Please retry.')
  if (moving) return { item: null }
  if (method === 'PATCH' && !payload?.length) throw Object.assign(new Error('Checklist item no longer exists. Refresh the list.'), { status: 404 })
  return method === 'GET' ? { items: payload } : { item: payload[0] ?? null }
}
