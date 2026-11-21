export const biginDatePresets = ['All time', 'Last 7 Days', 'Yesterday', 'This month', 'Last month']
export function biginPresetRange(preset, easternToday) {
  const date = new Date(`${easternToday}T00:00:00Z`)
  const day = offset => { const shifted = new Date(date); shifted.setUTCDate(shifted.getUTCDate() + offset); return shifted.toISOString().slice(0, 10) }
  const monthStart = new Date(date); monthStart.setUTCDate(1)
  if (preset === 'All time') return { from: '0001-01-01', to: easternToday }
  if (preset === 'Last 7 Days') return { from: day(-7), to: day(-1) }
  if (preset === 'Yesterday') return { from: day(-1), to: day(-1) }
  if (preset === 'This month') return { from: monthStart.toISOString().slice(0, 10), to: easternToday }
  if (preset === 'Last month') {
    const end = new Date(monthStart); end.setUTCDate(0)
    const start = new Date(end); start.setUTCDate(1)
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
  }
  throw new Error('Unknown date preset')
}
