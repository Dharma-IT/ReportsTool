import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { loadConfigFromFile } from 'vite'

test('Daily and Weekly share the ledger; uploads and API repairs preserve other report data', async () => {
  const originalFetch = globalThis.fetch
  const keys = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AIRCALL_API_ID', 'AIRCALL_API_TOKEN']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  Object.assign(process.env, { VITE_SUPABASE_URL: 'https://weekly-test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', AIRCALL_API_ID: 'test', AIRCALL_API_TOKEN: 'test' })
  let saved = { version: 9, hubSpot: { revenue: 777, products: {}, bySeller: {} }, leadManagement: {}, customerCare: {}, noShows: {}, csSourceMetrics: {} }
  const start = 1792382400
  const rows = new Map([
    [1, { call_id: 1, started_at: start + 36000, answered_at: start + 36000, ended_at: start + 36060, talk_seconds: 60, agent_name: 'Carlos Vargas', finalized: true, source: 'webhook', api_seen_at: null, webhook_seen_at: '2026-10-19', review_reason: null, raw_digits: '15551234567' }],
    [2, { call_id: 2, started_at: start + 37000, answered_at: start + 37000, ended_at: start + 37040, talk_seconds: 40, agent_name: 'Carlos Vargas', finalized: true, source: 'api', api_seen_at: '2026-10-19', webhook_seen_at: null, review_reason: null, raw_digits: '15557654321' }],
    [4, { call_id: 4, started_at: start + 38000, answered_at: start + 38000, ended_at: start + 38120, talk_seconds: 120, agent_name: 'Helen Gutierrez', finalized: true, source: 'webhook', api_seen_at: null, webhook_seen_at: '2026-10-19', review_reason: null, raw_digits: '15557777777' }],
  ])
  let apiRequests = 0
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.aircall.io') {
      apiRequests++
      return Response.json({ calls: [{ id: 1, started_at: start + 36000, answered_at: start + 36000, ended_at: start + 36002, user: { name: 'Carlos Vargas' } }, { id: 3, started_at: start + 39000, answered_at: start + 39000, ended_at: start + 39060, user: { name: 'Carlos Vargas' } }], meta: { next_page_link: null } })
    }
    assert.equal(url.hostname, 'weekly-test.invalid')
    if (url.pathname.endsWith('/weekly_reports')) {
      if (init.method === 'POST' || init.method === 'PATCH') { saved = JSON.parse(init.body).report_data; return new Response(null, { status: 204 }) }
      return Response.json([{ report_data: structuredClone(saved) }])
    }
    if (url.pathname.endsWith('/daily_report_agents')) return Response.json([{ display_name: 'Carlos Vargas', aliases: ['Carlos Vargas'] }, { display_name: 'Helen Gutierrez', aliases: ['Helen Gutierrez'] }])
    if (url.pathname.endsWith('/daily_reports')) return Response.json([{ report_data: { agents: [{ name: 'Carlos Vargas', totalTalkSeconds: 1, sales: 777, doxyTotalSeconds: 60 }] } }])
    if (url.pathname.endsWith('/aircall_reporting_calls')) {
      const filters = url.searchParams.getAll('started_at')
      const from = Number(filters.find((f) => f.startsWith('gte.')).slice(4)), to = Number(filters.find((f) => f.startsWith('lte.')).slice(4))
      return Response.json([...rows.values()].filter((r) => r.started_at >= from && r.started_at <= to))
    }
    if (url.pathname.endsWith('/aircall_reporting_syncs')) return init.method ? new Response(null, { status: 204 }) : Response.json([])
    if (url.pathname.endsWith('/rpc/merge_weekly_report_fields')) {
      const {p_fields} = JSON.parse(init.body)
      saved = { ...saved, ...p_fields, ...(p_fields.doxy ? { doxy: { ...saved.doxy, ...p_fields.doxy } } : {}) }
      return Response.json(saved)
    }
    if (url.pathname.endsWith('/rpc/ingest_aircall_reporting_calls')) {
      const body = JSON.parse(init.body)
      for (const call of body.p_calls) {
        const old = rows.get(call.id)
        if (old?.source === 'export' && body.p_source !== 'export') { old.api_seen_at = '2026-10-27'; continue }
        rows.set(call.id, { call_id: call.id, started_at: call.started_at, answered_at: call.answered_at, ended_at: call.ended_at, talk_seconds: call.talk_seconds ?? (call.ended_at - call.answered_at), agent_name: call.user?.name, finalized: true, source: body.p_source, raw_digits: call.raw_digits ?? '', api_seen_at: body.p_source === 'api' ? '2026-10-27' : old?.api_seen_at, webhook_seen_at: old?.webhook_seen_at, review_reason: null })
      }
      return new Response(null, { status: 204 })
    }
    throw new Error(`Unexpected database table ${url.pathname}`)
  }
  try {
    const { config } = await loadConfigFromFile({ command: 'serve', mode: 'development' })
    const plugin = config.plugins.flat(Infinity).find((p) => p?.name === 'aircall-agent-report-api')
    const handlers = new Map()
    plugin.configureServer({ middlewares: { use: (path, handler) => handlers.set(path, handler) } })
    const request = async (query, body, route = '/api/weekly-report') => {
      const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : [])
      req.url = `/?week=2026-10-19&${query}`; req.method = body ? 'POST' : 'GET'
      let payload
      const res = { statusCode: 0, setHeader() {}, end(text) { payload = JSON.parse(text) } }
      await handlers.get(route)(req, res)
      assert.equal(res.statusCode, 200, JSON.stringify(payload)); return payload
    }
    let weekly = await request('')
    let daily = await request('mode=saved&team=sales&from=2026-10-19&to=2026-10-24', undefined, '/api/daily-cs-report')
    assert.equal(weekly.calls.sales.lastWeek.agents.find((a) => a.name === 'Carlos Vargas').aircallSeconds, 100)
    assert.equal(daily.agents[0].totalTalkSeconds, 100)
    assert.equal(daily.agents[0].sales, 777)
    assert.equal(daily.agents[0].doxyTotalSeconds, 60)
    assert.equal(daily.agents.find((a) => a.name === 'Helen Gutierrez').hubSpotMissing, true)
    assert.equal(apiRequests, 0)
    await request('team=sales&mode=doxy', { agents: [{ name: 'Carlos Vargas', doxySeconds: 58557, doxyCalls: 80, unknownDurationCalls: 1 }] })
    const csvText = 'call start time,user,duration (in call),call id (internal),datetime (utc)\n2026-10-19 10:00:00,Carlos Vargas,24518,1,2026-10-19 14:00:00'
    await request('team=sales&mode=aircall', { fileName: 'correct.csv', csvText, agents: [{ name: 'Carlos Vargas', aircallSeconds: 24518, aircallCalls: 1 }] })
    weekly = await request('refresh=aircall')
    daily = await request('mode=saved&team=sales&from=2026-10-19&to=2026-10-24', undefined, '/api/daily-cs-report')
    const carlos = weekly.calls.sales.lastWeek.agents.find((a) => a.name === 'Carlos Vargas')
    assert.equal(carlos.aircallSeconds, 24618)
    assert.equal(daily.agents[0].totalTalkSeconds, carlos.aircallSeconds)
    assert.equal(carlos.doxySeconds, 58557)
    assert.equal(weekly.calls.sales.lastWeek.unknownDurationCalls, 1)
    assert.equal(saved.hubSpot.revenue, 777)
    assert.equal(rows.get(1).source, 'export')
    assert.equal(apiRequests, 1)
    await request('team=sales&mode=doxy', { agents: [{ name: 'Carlos Vargas', doxySeconds: 60, doxyCalls: 1 }] })
    weekly = await request('')
    assert.equal(weekly.calls.sales.lastWeek.agents.find((a) => a.name === 'Carlos Vargas').doxySeconds, 60)
    assert.equal(rows.get(1).talk_seconds, 24518)
  } finally {
    globalThis.fetch = originalFetch
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
  }
})
