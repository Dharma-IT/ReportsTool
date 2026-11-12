export const dealColumns = ['Deal Name', 'Meeting Type', 'Evaluation date and hour', 'Phone Number', 'Agent Lead Management', 'Lead Classification', 'Deal Stage', 'Close Date', 'Deal owner', 'Amount', 'Email', 'Paid date (all pipelines)', 'Product']
export function dealCsv(rows) {
  const stages = { 'NEW LEAD': 'New Leads', 'NEW LEADS': 'New Leads', 'NEW CLIENT': 'New Leads', 'PROBLEM': 'LOST', 'PAID': 'PAID', 'LOST': 'LOST', 'EVALUATION SCHEDULED': 'Evaluation Scheduled', 'FUTURE CONTACT': 'Future Contact', 'WAITING FOR PAYMENT': 'Waiting for Payment', 'WAITING FOT PAYMENT': 'Waiting for Payment', 'REFUND': 'Refund', 'DISPUTE WON': 'Dispute Won', 'MEDICALLY APPROVED (WON)': 'Closed Won', 'CLOSED WON': 'Closed Won' }
  const cell = value => {
    const text = String(value ?? '')
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [dealColumns, ...rows.map(row => {
    const values = row.slice(0, 12)
    values[3] = String(values[3] ?? '').replace(/\D/g, '')
    values[10] = values[3] ? `${values[3]}@dummy.com` : ''
    const sourceStage = String(values[6] ?? '').trim()
    values[6] = stages[sourceStage.toUpperCase()] ?? sourceStage
    for (const index of [7, 11]) {
      if (!String(values[index] ?? '').trim()) values[index] = '2020-01-01'
    }
    if (!String(values[8] ?? '').trim()) values[8] = 'Jeuz Vinci'
    return [...values, 'WLI']
  })].map(row => row.map(cell).join(',')).join('\r\n')
}
