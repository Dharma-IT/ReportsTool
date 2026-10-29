export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'error'

// Each date has one writer. Edits made during a request stay queued behind it.
export function createAdsAutosave<T extends { date: string }>(
  save: (row: T) => Promise<void>,
  notify: (date: string, status: SaveStatus, error?: string) => void,
  delay = 5000,
) {
  const entries = new Map<string, {
    row: T; revision: number; saved: number; timer?: ReturnType<typeof setTimeout>;
    running?: Promise<boolean>
  }>()
  async function flush(date: string): Promise<boolean> {
    const entry = entries.get(date)
    if (!entry) return true
    clearTimeout(entry.timer)
    if (entry.running) {
      if (!await entry.running) return false
      return flush(date)
    }
    if (entry.saved === entry.revision) return true
    const revision = entry.revision
    const row = { ...entry.row }
    notify(date, 'saving')
    entry.running = (async () => {
      try {
        await save(row)
        entry.saved = revision
        notify(date, entry.saved === entry.revision ? 'saved' : 'unsaved')
        return true
      } catch (error) {
        notify(date, 'error', error instanceof Error ? error.message : 'Unable to save ADS data.')
        return false
      }
    })()
    const success = await entry.running
    entry.running = undefined
    // A newer edit keeps its own inactivity timer unless explicitly flushed.
    return success
  }
  return {
    schedule(row: T) {
      const entry = entries.get(row.date) ?? { row, revision: 0, saved: 0 }
      entry.row = { ...row }
      entry.revision += 1
      clearTimeout(entry.timer)
      entry.timer = setTimeout(() => { void flush(row.date) }, delay)
      entries.set(row.date, entry)
      notify(row.date, 'unsaved')
    },
    async flushAll() {
      const results = await Promise.all([...entries.keys()].map(async (date) => {
        // Drain edits queued while a save was in flight.
        while (true) {
          if (!await flush(date)) return false
          const entry = entries.get(date)!
          if (entry.saved === entry.revision) return true
        }
      }))
      return results.every(Boolean)
    },
    hasPending() { return [...entries.values()].some((entry) => entry.saved !== entry.revision) },
  }
}
