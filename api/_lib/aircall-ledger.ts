export type LedgerCall = {
  id: number; started_at: number; answered_at: number | null; ended_at: number | null; finalized?: boolean
  raw_digits?: string; user?: { id?: number; name?: string | null } | null
  talk_seconds?: number
}
export type LedgerRecord = {
  call_id: number; finalized: boolean; source: 'api' | 'webhook' | 'export'
  api_seen_at: string | null; webhook_seen_at: string | null; review_reason: string | null
  call_data: LedgerCall
}
export type AircallQuality = {
  pendingCalls: number; reviewCalls: number; webhookRecoveredCalls: number; apiOnlyCalls: number
  exportReconciledCalls: number; knownCalls: number; apiError?: string; warnings: string[]
  unassignedCalls: number
}

export function talkSeconds(call: LedgerCall) {
  if (call.finalized === false) return 0
  return Number.isFinite(call.talk_seconds) ? Math.max(0, call.talk_seconds!) : call.answered_at == null || call.ended_at == null ? 0 : Math.max(0, call.ended_at - call.answered_at)
}

export function agentCallMetrics(calls: LedgerCall[]) {
  const valid = calls.filter((call) => call.answered_at != null && talkSeconds(call) > 60)
  return {
    numbersCalled: new Set(calls.map((call) => (call.raw_digits ?? '').replace(/\D/g, '')).filter(Boolean)).size,
    totalIntents: calls.length, validCalls: valid.length,
    averageCallSeconds: valid.length ? Math.round(valid.reduce((sum, call) => sum + talkSeconds(call), 0) / valid.length) : 0,
    totalTalkSeconds: calls.reduce((sum, call) => sum + talkSeconds(call), 0),
  }
}

export function summarizeAircall(records: LedgerRecord[], apiError?: string): AircallQuality {
  const pendingCalls = records.filter((row) => !row.finalized).length
  const reviewCalls = records.filter((row) => row.review_reason).length
  const unassignedCalls = records.filter((row) => row.finalized && row.call_data && !row.call_data.user?.name && talkSeconds(row.call_data) > 0).length
  const warnings = []
  if (!records.length) warnings.push('No call records are captured for this range. Reconcile Aircall or import a platform export to verify zero activity.')
  if (pendingCalls) warnings.push(`${pendingCalls} known call(s) are awaiting finalized data and are excluded from talk-time totals.`)
  if (reviewCalls) warnings.push(`${reviewCalls} call(s) have conflicting finalized agent or talk-time values and need review.`)
  if (unassignedCalls) warnings.push(`${unassignedCalls} connected call(s) have no captured agent and are excluded from per-agent totals.`)
  if (apiError) warnings.push(`API reconciliation did not complete: ${apiError}. Previously captured calls remain included.`)
  return {
    pendingCalls, reviewCalls, unassignedCalls, knownCalls: records.length,
    webhookRecoveredCalls: records.filter((row) => row.finalized && row.webhook_seen_at && !row.api_seen_at).length,
    apiOnlyCalls: records.filter((row) => row.finalized && row.api_seen_at && !row.webhook_seen_at).length,
    exportReconciledCalls: records.filter((row) => row.source === 'export').length,
    ...(apiError ? { apiError } : {}), warnings,
  }
}

// All report reads and API repairs use the same database. Incoming webhook events
// populate it transactionally through the database trigger in create-aircall-ledger.sql.
export class AircallLedger {
  private base: string
  private key: string
  private fetcher: typeof fetch
  private syncing = new Map<string, Promise<string | undefined>>()
  private recent = new Map<string, number>()

  constructor(url: string, key: string, fetcher: typeof fetch = fetch) {
    this.base = new URL('/rest/v1/', url).toString(); this.key = key; this.fetcher = fetcher
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await this.fetcher(new URL(path, this.base), {
      ...init, signal: AbortSignal.timeout(30000),
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', ...init.headers },
    })
    if (!response.ok) throw new Error(`Aircall ledger storage returned ${response.status}`)
    return response
  }

  async ingest(calls: LedgerCall[], source: 'api' | 'export' = 'api') {
    for (let index = 0; index < calls.length; index += 250) {
      await this.request('rpc/ingest_aircall_reporting_calls', {
        method: 'POST', body: JSON.stringify({ p_calls: calls.slice(index, index + 250), p_source: source }),
      })
    }
  }

  async read(from: number, to: number) {
    const rows: LedgerRecord[] = []
    let cursor: { started: number; id: number } | undefined
    while (true) {
      const params = new URLSearchParams({ select: 'call_id,started_at,answered_at,ended_at,agent_id,agent_name,talk_seconds,finalized,source,api_seen_at,webhook_seen_at,review_reason,raw_digits', order: 'started_at.asc,call_id.asc', limit: '1000' })
      params.append('started_at', `gte.${from}`); params.append('started_at', `lte.${to}`)
      if (cursor) params.set('or', `(started_at.gt.${cursor.started},and(started_at.eq.${cursor.started},call_id.gt.${cursor.id}))`)
      const page = await (await this.request(`aircall_reporting_calls?${params}`)).json() as Array<Omit<LedgerRecord, 'call_data'> & { started_at: number; answered_at: number | null; ended_at: number | null; agent_id: number | null; agent_name: string | null; talk_seconds: number; raw_digits: string | null }>
      rows.push(...page.map((row) => ({ ...row, call_data: {
        id: Number(row.call_id), started_at: row.started_at, answered_at: row.answered_at, ended_at: row.ended_at,
        user: row.agent_name ? { ...(row.agent_id ? { id: row.agent_id } : {}), name: row.agent_name } : null,
        talk_seconds: row.talk_seconds, raw_digits: row.raw_digits ?? '', finalized: row.finalized,
      } })))
      if (page.length < 1000) break
      const last = page[page.length - 1]
      const next = { started: Number(last.started_at), id: Number(last.call_id) }
      if (cursor && (next.started < cursor.started || (next.started === cursor.started && next.id <= cursor.id))) throw new Error('Aircall ledger pagination did not advance')
      cursor = next
    }
    return [...new Map(rows.map((row) => [Number(row.call_id), row])).values()]
  }

  async syncStatus(from: number, to: number) {
    const params = new URLSearchParams({ select: 'last_attempt,last_success,last_error', from_unix: `lte.${from}`, to_unix: `gte.${to}`, order: 'last_attempt.desc', limit: '1' })
    const rows = await (await this.request(`aircall_reporting_syncs?${params}`)).json() as Array<{ last_attempt: string; last_success: string | null; last_error: string | null }>
    return rows[0]
  }

  async sync(from: number, to: number, fetchCalls: (persistPage: (calls: LedgerCall[]) => Promise<void>) => Promise<LedgerCall[]>, force = false): Promise<string | undefined> {
    const key = `${from}:${to}`
    const active = this.syncing.get(key)
    if (active) return active
    // Avoid repeating API pagination when both teams fetch the same range.
    if (!force && Date.now() - (this.recent.get(key) ?? 0) < 5 * 60000) return
    const operation = (async () => {
      try {
        let persisted = false
        const calls = await fetchCalls(async (page) => {
          await this.ingest(page.filter((call) => call.started_at >= from && call.started_at <= to))
          persisted = true
        })
        if (!persisted) await this.ingest(calls.filter((call) => call.started_at >= from && call.started_at <= to))
        await this.request('aircall_reporting_syncs?on_conflict=from_unix,to_unix', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ from_unix: from, to_unix: to, last_attempt: new Date().toISOString(), last_success: new Date().toISOString(), last_error: null }),
        })
        this.recent.set(key, Date.now())
        return undefined
      } catch (error) {
        const message = error instanceof Error ? error.message : 'API synchronization failed'
        try {
          await this.request('aircall_reporting_syncs?on_conflict=from_unix,to_unix', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ from_unix: from, to_unix: to, last_attempt: new Date().toISOString(), last_error: message }),
          })
        } catch { /* Return the original failure even when health-state storage is unavailable. */ }
        return message
      } finally { this.syncing.delete(key) }
    })()
    this.syncing.set(key, operation)
    return operation
  }
}
