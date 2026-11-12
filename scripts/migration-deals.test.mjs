import test from 'node:test'
import assert from 'node:assert/strict'
import { migrationDeal, getMigrationDealPage } from '../api/_lib/migration-deals.js'
import { dealColumns, dealCsv } from '../src/lib/migration-deal-csv.js'
const metadata = { pipelines: [{ id: 'p1', stages: [{ id: 'paid', label: 'PAID' }] }], owners: { owner: 'Agent Name' }, options: { meeting_type: { cs: 'Customer Service' }, classification: { hot: 'Hot' } } }
test('CSV stage labels match the configured Bigin capitalization, including saved rows', () => {
  for (const [source, expected] of [['NEW LEAD', 'New Leads'], ['NEW LEADS', 'New Leads'], ['EVALUATION SCHEDULED', 'Evaluation Scheduled'], ['paid', 'PAID'], ['LOST', 'LOST'], ['FUTURE CONTACT', 'Future Contact'], ['WAITING FOR PAYMENT', 'Waiting for Payment'], ['WAITING FOT PAYMENT', 'Waiting for Payment'], ['REFUND', 'Refund'], ['DISPUTE WON', 'Dispute Won'], ['MEDICALLY APPROVED (WON)', 'Closed Won']]) {
    const row = Array(12).fill('')
    row[6] = source
    assert.equal(dealCsv([row]).split('\r\n')[1].split(',')[6], `"${expected}"`)
    assert.equal(row[6], source)
  }
})
test('Customer Service exports preserve unmapped stages without blocking or dropping saved rows', () => {
  const rows = ['PROBLEM', 'NEW CLIENT', 'Another Stage'].map(stage => {
    const row = Array(12).fill('')
    row[0] = 'Repeat Customer'
    row[6] = stage
    return row
  })
  const lines = dealCsv(rows).split('\r\n')
  assert.equal(lines.length, 4)
  assert.deepEqual(lines.slice(1).map(line => line.split(',')[6]), ['"PROBLEM"', '"NEW CLIENT"', '"Another Stage"'])
})

test('CSV fills blank owners and dates while preserving existing values and saved data', () => {
  const blank = Array(12).fill('')
  blank[7] = '  '
  const existing = [...blank]
  existing[7] = '2026-11-12'
  existing[8] = 'Original Owner'
  existing[11] = '2026-11-11'
  const lines = dealCsv([blank, existing]).split('\r\n').slice(1).map(line => line.split(','))
  assert.equal(lines[0][7], '"2020-01-01"')
  assert.equal(lines[0][8], '"Jeuz Vinci"')
  assert.equal(lines[0][11], '"2020-01-01"')
  assert.equal(lines[1][7], '"2026-11-12"')
  assert.equal(lines[1][8], '"Original Owner"')
  assert.equal(lines[1][11], '"2026-11-11"')
  assert.equal(blank[8], '')
})
test('deal export has exact 12 fields, decoded labels, date fields, cleaned name and dummy email', () => {
  const row = migrationDeal({ dealname: 'NEW SALE - Maria Cruz', phone: '+1 (347) 500-8081', meeting_type: 'cs', classification: 'hot', dealstage: 'paid', hubspot_owner_id: 'owner', amount: '100.50', paid_date_all_pipelines: '2026-11-11T00:00:00Z', closedate: '2026-11-12T02:00:00Z', evaluation_date_and_hour_2: '2026-11-10T12:00:00Z' }, metadata)
  assert.equal(dealColumns.length, 13)
  assert.deepEqual(row, ['Maria Cruz', 'Customer Service', '2026-11-10T12:00:00Z', '13475008081', '', 'Hot', 'PAID', '2026-11-12', 'Agent Name', '100.50', '13475008081@dummy.com', '2026-11-11'])
  for (const name of ['CS - Maria', 'Sellers - Maria', 'new sale: Maria']) assert.equal(migrationDeal({ dealname: name }, metadata)[0], 'Maria')
  for (const name of ['Damian - 5492920500281 -', 'CS - Damian - 123 -', 'Damian - -']) assert.equal(migrationDeal({ dealname: name }, metadata)[0], 'Damian')
  assert.equal(migrationDeal({ dealname: 'CS - Maria' }, metadata)[10], '')
  const csv = dealCsv([row, row])
  assert.equal(csv.split('\r\n').length, 3)
  assert.ok(csv.includes('Paid date (all pipelines)'))
  assert.equal(csv.split('\r\n')[0].split(',').at(-1), '"Product"')
  assert.ok(!dealColumns.includes('Sub-Pipeline'))
  assert.ok(csv.split('\r\n').slice(1).every(line => line.endsWith(',"WLI"')))
  assert.ok(dealCsv([['=danger,"value"']]).includes("'=danger,"))
})
test('fresh deal reads preserve repeats, recover linked phones, exclude missing phones and fetch paid dates', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const path = String(url)
    let payload
    if (path.includes('/pipelines/')) payload = { results: [{ id: 'p1', label: 'New leads', stages: [] }] }
    else if (path.includes('/properties/')) payload = { results: [{ name: 'paid_date_all_pipelines' }] }
    else if (path.includes('/owners')) payload = { results: [] }
    else if (path.includes('/deals/batch/read')) {
      assert.ok(JSON.parse(options.body).properties.includes('paid_date_all_pipelines'))
      payload = { results: [{ id: '1', properties: { phone: '123', dealname: 'CS - A - 999', paid_date_all_pipelines: '2026-11-11' } }, { id: '2', properties: { phone: '123', dealname: 'CS - A' } }, { id: '3', properties: { dealname: 'B' } }, { id: '4', properties: { dealname: 'C' } }] }
    }
    else if (path.includes('/contacts/batch/read')) payload = { results: [{ id: 'c', properties: { mobilephone: '+1 234 567' } }] }
    else {
      assert.ok(path.includes('after=999999'))
      assert.ok(!path.includes('/search'))
      payload = { results: [{ id: '1', properties: { pipeline: 'p1' } }, { id: '2', properties: { pipeline: 'p1' } }, { id: '3', properties: { pipeline: 'p1' }, associations: { contacts: { results: [{ id: 'c' }] } } }, { id: '4', properties: { pipeline: 'p1' } }, { id: '5', properties: { pipeline: 'p2' } }], paging: { next: { after: '1000000' } } }
    }
    return new Response(JSON.stringify(payload), { status: 200 })
  }
  try {
    const page = await getMigrationDealPage('test-token', 'p1', '999999')
    assert.equal(page.rows.length, 3)
    assert.equal(page.scanned, 5)
    assert.equal(page.missingPhone, 1)
    assert.equal(page.after, '1000000')
    assert.equal(page.rows[0][3], page.rows[1][3])
    assert.equal(page.rows[0][11], '2026-11-11')
    assert.equal(page.rows[1][11], '')
    assert.equal(page.rows[2][3], '1234567')
    assert.equal(page.recoveredPhone, 1)
    assert.equal(page.withPaidDate, 1)
    assert.equal(page.missingPaidDate, 2)
  } finally { globalThis.fetch = original }
})
