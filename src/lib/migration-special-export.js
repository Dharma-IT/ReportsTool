function parseCsv(text) {
  const rows = []
  let row = [], value = '', quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && char === ',') { row.push(value); value = '' }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(value)
      if (row.some(Boolean)) rows.push(row)
      row = []; value = ''
    } else value += char
  }
  if (quoted) throw new Error('CSV contains an unfinished quoted value.')
  row.push(value)
  if (row.some(Boolean)) rows.push(row)
  return rows
}
export function specialExportContacts(text) {
  const [headers = [], ...rows] = parseCsv(text)
  const column = name => headers.findIndex(header => header.trim().toLowerCase() === name.toLowerCase())
  const errorIndex = column('Errors'), nameIndex = column('Deal Name'), phoneIndex = column('Phone Number'), emailIndex = column('Email')
  if ([errorIndex, nameIndex, phoneIndex, emailIndex].some(index => index < 0)) throw new Error('Select the Bigin skipped-records CSV containing Errors, Deal Name, Phone Number, and Email columns.')
  const contacts = [], seen = new Set()
  let matched = 0, duplicates = 0, excluded = 0
  for (const row of rows) {
    if (!/matching parent record/i.test(row[errorIndex] ?? '') || !/\bEmail\b/i.test(row[errorIndex] ?? '')) continue
    matched++
    const name = (row[nameIndex] ?? '').trim()
    const email = (row[emailIndex] ?? '').trim().toLowerCase()
    const match = email.match(/^(\d+)@dummy\.com$/)
    const phone = match?.[1] ?? (row[phoneIndex] ?? '').replace(/\D/g, '')
    if (!name || !phone) { excluded++; continue }
    if (seen.has(phone)) { duplicates++; continue }
    seen.add(phone)
    contacts.push({ name, phone, email: `${phone}@dummy.com` })
  }
  return { contacts, matched, duplicates, excluded }
}
export function specialExportCsv(contacts) {
  const cell = value => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`
  return '\uFEFFName,Phone,Email\r\n' + contacts.map(contact => [contact.name, contact.phone, contact.email].map(cell).join(',')).join('\r\n')
}
