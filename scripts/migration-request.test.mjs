import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMigrationDeals } from '../src/lib/migration-request.js'

test('failed external API falls back to same-origin without changing the page cursor', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    if (calls.length === 1) throw new TypeError('Failed to fetch')
    return Response.json({ rows: [], after: '123' })
  }
  try {
    assert.deepEqual(await fetchMigrationDeals('https://backend.example', 'pipeline=1&after=99'), { rows: [], after: '123' })
    assert.deepEqual(calls, ['https://backend.example/api/migration/deals?pipeline=1&after=99', '/api/migration/deals?pipeline=1&after=99'])
  } finally { globalThis.fetch = original }
})

test('network failures get a bounded retry and a useful error', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch') }
  try {
    await assert.rejects(fetchMigrationDeals('', 'metadata=1'), /after automatic retries/)
    assert.equal(calls, 3)
  } finally { globalThis.fetch = original }
})
