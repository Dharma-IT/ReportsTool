import test from 'node:test'
import assert from 'node:assert/strict'
import { migrationDeal, getMigrationDealPage } from '../api/_lib/migration-deals.js'
import { dealColumns, dealCsv } from '../src/lib/migration-deal-csv.js'
const metadata = { pipelines: [{ id: 'p1', stages: [{ id: 'paid', label: 'PAID' }] }], owners: { owner: 'Agent Name' }, options: { meeting_type: { cs: 'Customer Service' }, classification: { hot: 'Hot' } } }
test('deal export has exact 12 fields, decoded labels, date fields, cleaned name and dummy email', () => {
  const row = migrationDeal({ dealname: 'NEW SALE - Maria Cruz', phone: '+1 (347) 500-8081', meeting_type: 'cs', classification: 'hot', dealstage: 'paid', hubspot_owner_id: 'owner', amount: '100.50', paid_date_all_pipelines: '2026-11-11T00:00:00Z', closedate: '2026-11-12T02:00:00Z', evaluation_date_and_hour_2: '2026-11-10T12:00:00Z' }, metadata)
  assert.equal(dealColumns.length, 12)
  assert.deepEqual(row, ['Maria Cruz', 'Customer Service', '2026-11-10T12:00:00Z', '13475008081', '', 'Hot', 'PAID', '2026-11-12', 'Agent Name', '100.50', '13475008081@dummy.com', '2026-11-11'])
  for (const name of ['CS - Maria', 'Sellers - Maria', 'new sale: Maria']) assert.equal(migrationDeal({ dealname: name }, metadata)[0], 'Maria')
  assert.equal(migrationDeal({ dealname: 'CS - Maria' }, metadata)[10], '')
  const csv = dealCsv([row, row])
  assert.equal(csv.split('\r\n').length, 3)
  assert.ok(csv.includes('Paid date (all pipelines)'))
  assert.ok(dealCsv([['=danger,"value"']]).includes("'=danger,"))
})
test('list pagination filters selected pipeline and retains repeated customer deals and missing phones', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async url => {
    const path = String(url)
    let payload
    if (path.includes('/pipelines/')) payload = { results: [{ id: 'p1', label: 'New leads', stages: [] }] }
    else if (path.includes('/properties/')) payload = { results: [] }
    else if (path.includes('/owners')) payload = { results: [] }
    else {
      assert.ok(path.includes('after=999999'))
      assert.ok(!path.includes('/search'))
      payload = { results: [{ properties: { pipeline: 'p1', phone: '123', dealname: 'CS - A' } }, { properties: { pipeline: 'p1', phone: '123', dealname: 'CS - A' } }, { properties: { pipeline: 'p1', dealname: 'B' } }, { properties: { pipeline: 'p2', phone: '456' } }], paging: { next: { after: '1000000' } } }
    }
    return new Response(JSON.stringify(payload), { status: 200 })
  }
  try {
    const page = await getMigrationDealPage('test-token', 'p1', '999999')
    assert.equal(page.rows.length, 3)
    assert.equal(page.scanned, 4)
    assert.equal(page.missingPhone, 1)
    assert.equal(page.after, '1000000')
    assert.deepEqual(page.rows[0], page.rows[1])
  } finally { globalThis.fetch = original }
})
