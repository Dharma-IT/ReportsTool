const DEFAULT_PRODUCTS = [
  ['Fat Burner with MCT', 7.59],
  ['Berberine', 5.04],
  ['Detox tea', 3],
  ['Slim Boost', 16],
  ['Maca Plus', 5.75],
  ['Brain & Focus Formula', 4.85],
  ['Energy Strips', 8.19],
  ['Hair, Skin and Nails Essentials', 5.79],
  ['Complete Multivitamin', 5.69],
  ['Grass-Fed Collagen Creamer (Vanilla)', 20.05],
  ['Sleep Strips', 7.55],
  ['Advanced 100% Whey Protein Isolate (Vanilla)', 39.95],
  ['Creatine Monohydrate', 10.95],
  ['Grass-Fed Collagen Peptides Powder (Chocolate)', 17.45],
  ['Advanced 100% Whey Protein Isolate (Chocolate)', 39.95],
  ['Grass-Fed Hydrolyzed Collagen Peptides', 15.29],
  ['GLP-1 Support', 6.65],
  ['Hydration Powder (Lemonade)', 11.29],
  ['Hydration Powder (Peach Mango)', 11.29],
  ['Hydration Powder (Lychee)', 11.45],
  ['Hydration Powder (Passion Fruit)', 11.25],
  ['Plant Protein (Vanilla)', 27.45],
  ['Magnesium Glycinate', 6.59],
  ['Plant Protein (Chocolate)', 26.55],
  ['Colon Gentle Cleanse', 15.55],
  ['Sleep Formula', 5.25],
  ['Vitamin D3 2,000 IU', 7.45],
  ['Probiotic 40 Billion with Prebiotics', 8.15],
  ['Apple Cider Vinegar Capsules', 4.55],
  ['Digestive Enzyme Pro Blend', 5.29],
  ['Max Detox (Acai detox)', 5.75],
  ['Diet Drops Ultra 1 oz', 4.85],
  ['Bone & Heart Support', 5.29],
  ['NAD+', 9.25],
  ['Omega-3 EPA 180mg + DHA 120mg', 8.85],
]

function supabaseRestUrl() {
  const configured = process.env.VITE_SUPABASE_URL?.trim()
  if (!configured) throw new Error('VITE_SUPABASE_URL is not configured')
  const normalized = configured.replace(/\/$/, '')
  return normalized.endsWith('/rest/v1') ? normalized : `${normalized}/rest/v1`
}

function headers(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra }
}

export function normalizeSupplementProductName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\bsubscription\b/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}

function validateProduct(product, requireId = false) {
  const id = String(product?.id || '').trim()
  const name = String(product?.name || '').trim()
  const unitCost = Number(product?.unit_cost)
  if (requireId && !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Choose a valid product')
  if (!name) throw new Error('Product name is required')
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Unit cost must be zero or greater')
  return { id, name, match_name: normalizeSupplementProductName(name), unit_cost: Math.round(unitCost * 100) / 100 }
}

async function seedProductsIfEmpty() {
  const countResponse = await fetch(`${supabaseRestUrl()}/supplement_products?select=id&limit=1`, { headers: headers() })
  const existing = await countResponse.json().catch(() => [])
  if (!countResponse.ok) throw new Error(existing.message || `Product catalog lookup failed with ${countResponse.status}`)
  if (existing.length) return
  const rows = DEFAULT_PRODUCTS.map(([name, unit_cost]) => ({ name, unit_cost, match_name: normalizeSupplementProductName(name) }))
  const response = await fetch(`${supabaseRestUrl()}/supplement_products?on_conflict=match_name`, {
    method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(rows),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || `Product catalog seed failed with ${response.status}`)
  }
}

export async function getSupplementProducts() {
  await seedProductsIfEmpty()
  const response = await fetch(`${supabaseRestUrl()}/supplement_products?select=id,name,match_name,unit_cost,created_at,updated_at&order=name.asc`, { headers: headers() })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Product catalog failed with ${response.status}`)
  return { products: payload }
}

export async function createSupplementProduct(product) {
  const value = validateProduct(product)
  const response = await fetch(`${supabaseRestUrl()}/supplement_products`, {
    method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ name: value.name, match_name: value.match_name, unit_cost: value.unit_cost }),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(response.status === 409 ? 'A product with that name already exists' : payload.message || `Product creation failed with ${response.status}`)
  return { product: payload[0] }
}

export async function updateSupplementProduct(product) {
  const value = validateProduct(product, true)
  const response = await fetch(`${supabaseRestUrl()}/supplement_products?id=eq.${encodeURIComponent(value.id)}`, {
    method: 'PATCH', headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ name: value.name, match_name: value.match_name, unit_cost: value.unit_cost }),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(response.status === 409 ? 'A product with that name already exists' : payload.message || `Product update failed with ${response.status}`)
  if (!payload[0]) throw new Error('Product not found')
  return { product: payload[0] }
}

export async function deleteSupplementProduct(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw new Error('Choose a valid product')
  const response = await fetch(`${supabaseRestUrl()}/supplement_products?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: headers({ Prefer: 'return=representation' }),
  })
  const payload = await response.json().catch(() => [])
  if (!response.ok) throw new Error(payload.message || `Product deletion failed with ${response.status}`)
  if (!payload[0]) throw new Error('Product not found')
  return { product: payload[0] }
}

export function findSupplementProductCost(name, products) {
  const normalized = normalizeSupplementProductName(name)
  const sourceTokens = new Set(normalized.split(' ').filter(Boolean))
  const matches = products.map((product) => {
    const matchName = normalizeSupplementProductName(product.match_name || product.name)
    if (normalized.includes(matchName)) return { product, score: 2 + matchName.length / 1000 }
    const tokens = matchName.split(' ').filter(Boolean)
    const matched = tokens.filter((token) => sourceTokens.has(token)).length
    const coverage = tokens.length ? matched / tokens.length : 0
    const qualifies = tokens.length === 1 ? coverage === 1 : matched >= 2 && coverage >= 0.6
    return { product, score: qualifies ? coverage + matched / 100 : 0 }
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score)
  return matches[0] ? Number(matches[0].product.unit_cost) : null
}
