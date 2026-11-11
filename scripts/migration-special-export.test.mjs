import test from 'node:test'
import assert from 'node:assert/strict'
import { specialExportContacts, specialExportCsv } from '../src/lib/migration-special-export.js'
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
