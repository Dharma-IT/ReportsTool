export const dealColumns = ['Deal Name', 'Meeting Type', 'Evaluation date and hour', 'Phone Number', 'Agent Lead Management', 'Lead Classification', 'Deal Stage', 'Close Date', 'Deal owner', 'Amount', 'Email', 'Paid date (all pipelines)']
export function dealCsv(rows) {
  const cell = value => {
    const text = String(value ?? '')
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [dealColumns, ...rows].map(row => row.map(cell).join(',')).join('\r\n')
}
