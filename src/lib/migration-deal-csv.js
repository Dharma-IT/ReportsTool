export const dealColumns = ['Deal Name', 'Meeting Type', 'Evaluation date and hour', 'Phone Number', 'Agent Lead Management', 'Lead Classification', 'Deal Stage', 'Close Date', 'Deal owner', 'Amount', 'Email', 'Paid date (all pipelines)', 'Product']
export function dealCsv(rows) {
  const stages = { 'NEW LEAD': 'New Leads', 'NEW LEADS': 'New Leads', 'PAID': 'PAID', 'LOST': 'LOST', 'EVALUATION SCHEDULED': 'Evaluation Scheduled' }
  const cell = value => {
    const text = String(value ?? '')
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [dealColumns, ...rows.map(row => {
    const values = row.slice(0, 12)
    values[6] = stages[String(values[6] ?? '').trim().toUpperCase()] ?? values[6]
    return [...values, 'WLI']
  })].map(row => row.map(cell).join(',')).join('\r\n')
}
