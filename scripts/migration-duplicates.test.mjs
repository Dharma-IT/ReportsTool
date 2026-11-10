import test from 'node:test'
import assert from 'node:assert/strict'
import { uniqueMigrationContacts, rebuildMigrationExports } from '../src/lib/migration-duplicates.js'
const contact = (phone, name = 'First') => ({ name, phone, email: 'old@example.com' })
test('normalize full phone, retain first name, preserve country code differences', () => {
  const result = uniqueMigrationContacts([contact('+1 (347) 500-8081'), contact('13475008081', 'Second'), contact('3475008081')])
  assert.equal(result.duplicates, 1)
  assert.deepEqual(result.contacts, [
    { name: 'First', phone: '13475008081', email: '13475008081@dummy.com' },
    { name: 'First', phone: '3475008081', email: '3475008081@dummy.com' },
  ])
})
test('remove cross-export and pending duplicates and repack to 10000', () => {
  const contacts = Array.from({ length: 20003 }, (_, i) => contact(String(10000000000 + i)))
  const batches = [{ number: 1, contacts: contacts.slice(0, 10000) }, { number: 2, contacts: [contacts[0], ...contacts.slice(10000, 19999)] }, { number: 3, contacts: contacts.slice(19999) }]
  const result = rebuildMigrationExports(batches, [contacts[1]], true)
  assert.equal(result.duplicates, 2)
  assert.deepEqual(result.batches.map(b => b.contacts.length), [10000, 10000, 3])
  assert.equal(new Set(result.batches.flatMap(b => b.contacts.map(c => c.phone))).size, 20003)
  const again = rebuildMigrationExports(result.batches, result.pending, true)
  assert.equal(again.duplicates, 0)
  assert.deepEqual(again.batches, result.batches)
})
test('unfinished migration retains partial batch and shared seen set filters later pages', () => {
  const result = rebuildMigrationExports([{ number: 1, contacts: [contact('123'), contact('123')] }], [contact('456')], false)
  assert.equal(result.batches.length, 0)
  assert.equal(result.pending.length, 2)
  const seen = new Set(result.pending.map(c => c.phone))
  const page = uniqueMigrationContacts([contact('456'), contact('789')], seen)
  assert.equal(page.duplicates, 1)
  assert.deepEqual(page.contacts.map(c => c.phone), ['789'])
})
