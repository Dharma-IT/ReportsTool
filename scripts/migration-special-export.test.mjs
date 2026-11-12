import test from 'node:test'
import assert from 'node:assert/strict'
import { specialExportContacts, specialExportCsv, skippedPipelineRows } from '../src/lib/migration-special-export.js'
import { dealColumns, dealCsv } from '../src/lib/migration-deal-csv.js'
test('special contacts only include missing-email errors and deduplicate by exact email phone', () => {
 const input = '\uFEFFDeal Name,Phone Number,Email,Errors\r\n"Maria, Cruz",+123,123@dummy.com,Could not find a matching parent record for this lookup field. - Email.\r\nMaria,123,123@dummy.com,Invalid Data - Deal Stage. Could not find a matching parent record for this lookup field. - Email.\r\nOther,456,456@dummy.com,Invalid Data - Deal Stage.\r\n'
 const result = specialExportContacts(input)
 assert.equal(result.matched, 2)
 assert.equal(result.duplicates, 1)
 assert.deepEqual(result.contacts, [{ name: 'Maria, Cruz', phone: '123', email: '123@dummy.com' }])
 assert.equal(specialExportCsv(result.contacts), '\uFEFFName,Phone,Email\r\n"Maria, Cruz","123","123@dummy.com"')
})
test('reject original export without error details', () => {
 assert.throws(() => specialExportContacts('Name,Phone,Email\nA,123,123@dummy.com'), /skipped-records CSV/)
})

test('pipeline retry keeps all error rows and repeat purchases, removes import metadata, and applies current mappings', () => {
  const headers = ['Row Number', ...dealColumns, 'Warnings', 'Errors']
  const rows = ['NEW CLIENT', 'PROBLEM', 'PAID'].map((stage, index) => {
    const values = Array(13).fill('')
    values[0] = 'CS - Maria - 123'
    values[3] = '+1 (234) 567-8901'
    values[6] = stage
    values[10] = 'wrong@example.com'
    return [String(index + 1), ...values, '', index === 2 ? '' : index === 0 ? 'Email lookup error' : 'Invalid Data - Deal Stage.']
  })
  const input = [headers, ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const retry = skippedPipelineRows(input)
  assert.equal(retry.length, 2)
  assert.equal(retry[0][0], 'Maria')
  assert.equal(retry[1][0], 'Maria')
  const csv = dealCsv(retry)
  assert.ok(!csv.includes('Row Number'))
  assert.ok(!csv.includes('Warnings'))
  assert.ok(!csv.includes('Errors'))
  assert.ok(csv.includes('"New Leads"'))
  assert.ok(csv.includes('"LOST"'))
  assert.equal(csv.match(/12345678901@dummy.com/g).length, 2)
  assert.equal(csv.split('\r\n').length, 3)
})
