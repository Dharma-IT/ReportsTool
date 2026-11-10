export function uniqueMigrationContacts(contacts, seen = new Set()) {
  const unique = []
  let duplicates = 0
  for (const contact of contacts) {
    const phone = contact.phone.replace(/\D/g, '')
    if (seen.has(phone)) { duplicates++; continue }
    seen.add(phone)
    unique.push({ ...contact, phone, email: `${phone}@dummy.com` })
  }
  return { contacts: unique, duplicates }
}

export function rebuildMigrationExports(batches, pending, done) {
  const result = uniqueMigrationContacts([...batches.flatMap(batch => batch.contacts), ...pending])
  const rebuilt = []
  let offset = 0
  while (result.contacts.length - offset >= 10000 || (done && offset < result.contacts.length)) {
    rebuilt.push({ number: rebuilt.length + 1, contacts: result.contacts.slice(offset, offset + 10000) })
    offset += 10000
  }
  return { batches: rebuilt, pending: result.contacts.slice(offset), duplicates: result.duplicates }
}
