const domains = /^(https:\/\/)(www\.)?zohoapis\.(com|eu|com\.au|in|com\.cn|jp|sa|ca)$/
let cachedToken
let pendingToken
async function credentials(env) {
  const domain = (env.BIGIN_API_DOMAIN || '').replace(/\/$/, '')
  if (!domains.test(domain) || !env.BIGIN_CLIENT_ID || !env.BIGIN_CLIENT_SECRET || !env.BIGIN_REFRESH_TOKEN) throw new Error('Bigin credentials are not configured on the server.')
  const key = [domain, env.BIGIN_CLIENT_ID, env.BIGIN_CLIENT_SECRET, env.BIGIN_REFRESH_TOKEN].join('|')
  if (cachedToken?.key === key && cachedToken.until > Date.now()) return cachedToken
  if (pendingToken?.key === key) return pendingToken.promise
  const promise = (async () => {
    const suffix = new URL(domain).hostname.replace(/^(www\.)?zohoapis\./, '')
    const response = await fetch(`https://accounts.zoho.${suffix}/oauth/v2/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.BIGIN_CLIENT_ID, client_secret: env.BIGIN_CLIENT_SECRET, refresh_token: env.BIGIN_REFRESH_TOKEN }), signal: AbortSignal.timeout(20000) })
    const data = await response.json()
    if (!response.ok || !data.access_token) throw new Error('Bigin authentication failed. Check the server OAuth credentials.')
    const base = data.api_domain || domain
    if (!domains.test(base)) throw new Error('Unexpected Bigin API domain.')
    cachedToken = { key, base, token: data.access_token, until: Date.now() + (Number(data.expires_in || 3600) - 120) * 1000 }
    return cachedToken
  })()
  pendingToken = { key, promise }
  try { return await promise } finally { pendingToken = undefined }
}
async function get(path, env) {
  const auth = await credentials(env)
  const response = await fetch(`${auth.base}/bigin/v2${path}`, { headers: { Authorization: `Zoho-oauthtoken ${auth.token}` }, signal: AbortSignal.timeout(25000) })
  if (response.status === 204) return { data: [], info: { more_records: false } }
  const data = await response.json()
  if (!response.ok) {
    if (data.code === 'INVALID_TOKEN') cachedToken = undefined
    throw new Error(data.code === 'OAUTH_SCOPE_MISMATCH' ? 'Bigin token needs pipeline and contact read permissions.' : `Bigin request failed (${data.code || response.status}). Please retry.`)
  }
  return data
}
export function validateTransactionQuery(query) {
  const from = query.get('from') || '', to = query.get('to') || ''
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const pipeline = query.get('pipeline') || ''
  const page = Number(query.get('page') || 1)
  if (!valid(from) || !valid(to) || from > to) throw Object.assign(new Error('Choose a valid start and end date.'), { status: 400 })
  if (!['New Leads', 'Customer Service'].includes(pipeline) || !Number.isInteger(page) || page < 1 || page > 10) throw Object.assign(new Error('Invalid pipeline or page.'), { status: 400 })
  return { from, to, pipeline, page }
}
export async function getBiginTransactions(query, env = process.env) {
  const { from, to, pipeline, page } = validateTransactionQuery(query)
  const stage = query.get('report') === 'refunds' ? 'Refund' : 'PAID'
  const criteria = `(((Pipeline:equals:${pipeline})and(Stage:equals:${stage}))and(Paid_Date:between:${from},${to}))`
  const result = await get('/Pipelines/search?' + new URLSearchParams({ criteria, page: String(page), per_page: '200', fields: 'Deal_Name,Owner,Amount,Contact_Name,Stage,Paid_Date,Phone_Number,Payment_Notes' }), env)
  if (page === 10 && result.info?.more_records) throw new Error('This date range exceeds Bigin?s 2,000-record search limit per pipeline. Choose a shorter date range to get a complete total.')
  const deals = result.data || []
  const ids = [...new Set(deals.map(d => d.Contact_Name?.id).filter(Boolean))]
  const contacts = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const response = await get('/Contacts?' + new URLSearchParams({ ids: ids.slice(i, i + 100).join(','), fields: 'Full_Name,First_Name,Last_Name,Email,Phone,Mobile' }), env)
    for (const contact of response.data || []) contacts.set(contact.id, contact)
  }
  const rows = deals.filter(d => d.Stage === stage && d.Paid_Date >= from && d.Paid_Date <= to).map(d => {
    const contact = contacts.get(d.Contact_Name?.id)
    return { id: d.id, paidDate: d.Paid_Date, owner: d.Owner?.name || '', amount: Number(d.Amount || 0), contact: contact?.Full_Name || d.Contact_Name?.name || '', email: contact?.Email || '', phone: d.Phone_Number || contact?.Phone || contact?.Mobile || '', pipeline, dealName: d.Deal_Name || '', stage: d.Stage, firstName: contact?.First_Name || '', lastName: contact?.Last_Name || '', paymentNotes: d.Payment_Notes || '' }
  })
  return { rows, more: Boolean(result.info?.more_records) }
}

const optionalNumber = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
export function mapBiginItems(deal, contact = {}) {
  const common = { dealId: deal.id, paidDate: deal.Paid_Date, dealName: deal.Deal_Name || '', owner: deal.Owner?.name || '', firstName: contact.First_Name || '', lastName: contact.Last_Name || '', amount: optionalNumber(deal.Amount), installmentFee: optionalNumber(deal.Installments) }
  const products = deal.Associated_Products || []
  if (deal.$has_more?.Associated_Products) throw new Error('Bigin returned an incomplete product list for a deal. Item report cannot be completed.')
  if (!products.length) return deal.Product ? [{ ...common, id: `${deal.id}:product`, name: deal.Product, unitPrice: null, quantity: null, discount: null, itemAmount: null, source: 'Product field only' }] : []
  return products.map((item, index) => {
    const price = optionalNumber(item.List_Price), quantity = optionalNumber(item.Quantity), percentage = optionalNumber(item.Discount)
    const discount = optionalNumber(item.Discount_Amount) ?? (price !== null && quantity !== null && percentage !== null ? Math.round(price * quantity * percentage) / 100 : null)
    return { ...common, id: `${deal.id}:${item.id || index}`, name: item.Product?.name || 'Unnamed product', unitPrice: price, quantity, discount, itemAmount: optionalNumber(item.Total), source: 'Linked product' }
  })
}
export async function getBiginItems(query, env = process.env) {
  const ids = [...new Set((query.get('ids') || '').split(','))]
  if (!ids.length || ids.length > 20 || ids.some(id => !/^\d+$/.test(id))) throw Object.assign(new Error('Choose up to 20 valid deal IDs.'), { status: 400 })
  const deals = []
  for (let i = 0; i < ids.length; i += 4) {
    const batch = await Promise.all(ids.slice(i, i + 4).map(id => get(`/Pipelines/${id}`, env)))
    for (const result of batch) {
      const deal = result.data?.[0]
      if (!deal) throw new Error('A deal could not be read. Reload the report to try again.')
      const pipeline = typeof deal.Pipeline === 'string' ? deal.Pipeline : deal.Pipeline?.name
      if (deal.Stage === 'PAID' && ['New Leads', 'Customer Service'].includes(pipeline)) deals.push(deal)
    }
  }
  const contactIds = [...new Set(deals.map(deal => deal.Contact_Name?.id).filter(Boolean))]
  const contacts = contactIds.length ? await get('/Contacts?' + new URLSearchParams({ ids: contactIds.join(','), fields: 'First_Name,Last_Name' }), env) : { data: [] }
  const byId = new Map((contacts.data || []).map(contact => [contact.id, contact]))
  return { items: deals.flatMap(deal => mapBiginItems(deal, byId.get(deal.Contact_Name?.id))), missingProducts: deals.filter(deal => !deal.Associated_Products?.length && !deal.Product).length }
}
