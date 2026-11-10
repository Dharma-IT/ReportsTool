import test from 'node:test'
import assert from 'node:assert/strict'
import { migrationContact, getMigrationPage } from '../api/_lib/migration.js'

test('export only named contacts with phone digits and generated email', () => {
  assert.deepEqual(migrationContact({ firstname: ' Adi ', lastname: ' Test ', phone: '+1 (347) 500-8081', email: 'real@example.com' }), { contact: { name: 'Adi Test', phone: '13475008081', email: '13475008081@dummy.com' } })
  assert.deepEqual(migrationContact({ firstname: ' ', phone: '1234' }), { reason: 'noName' })
  assert.deepEqual(migrationContact({ firstname: 'Adi' }), { reason: 'noPhone' })
  assert.deepEqual(migrationContact({ lastname: 'Adi', phone: ' ', mobilephone: '+502-5935-4807' }), { contact: { name: 'Adi', phone: '50259354807', email: '50259354807@dummy.com' } })
})

test('read-only contact pages retain cursor and exclusion counts', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get('after'), '123')
    assert.equal(url.searchParams.get('limit'), '100')
    assert.equal(options.method, undefined)
    return new Response(JSON.stringify({ results: [
      { properties: { firstname: 'Adi', phone: '1234' } },
      { properties: { phone: '5678' } },
      { properties: { firstname: 'No phone' } },
    ], paging: { next: { after: '456' } } }), { status: 200 })
  }
  try {
    const page = await getMigrationPage('test-token', '123')
    assert.equal(page.after, '456')
    assert.equal(page.scanned, 3)
    assert.equal(page.noName, 1)
    assert.equal(page.noPhone, 1)
    assert.deepEqual(page.contacts, [{ name: 'Adi', phone: '1234', email: '1234@dummy.com' }])
  } finally { globalThis.fetch = original }
})
