const LAST_EXPORT_KEY = 'gt2fx.backup.lastexport'
const DISMISS_KEY = 'gt2fx.backup.reminderdismissed'

const DAY_MS = 24 * 60 * 60 * 1000
const THRESHOLD_MS = 7 * DAY_MS

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Call after any successful backup (manual export or Sunday auto-backup). */
export function markExported(): void {
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))
  localStorage.removeItem(DISMISS_KEY)
}

export interface BackupReminder {
  show: boolean
  neverExported: boolean
  daysSince: number | null
}

/**
 * Remind when the journal hasn't been backed up in 7+ days.
 * Journal age is measured from the oldest trade, so brand-new users aren't nagged.
 */
export function getBackupReminder(trades: { createdAt: number }[]): BackupReminder {
  if (trades.length === 0) return { show: false, neverExported: true, daysSince: null }
  const raw = localStorage.getItem(LAST_EXPORT_KEY)
  const lastExport = raw !== null && isFinite(Number(raw)) ? Number(raw) : null
  const oldest = Math.min(...trades.map(t => t.createdAt))
  const ref = lastExport ?? oldest
  const elapsed = Date.now() - ref
  const dismissedOn = localStorage.getItem(DISMISS_KEY)
  const show = elapsed >= THRESHOLD_MS && dismissedOn !== todayKey()
  return { show, neverExported: lastExport === null, daysSince: Math.floor(elapsed / DAY_MS) }
}

/** Hide the reminder for the rest of today (it returns tomorrow until a backup happens). */
export function dismissReminderForToday(): void {
  localStorage.setItem(DISMISS_KEY, todayKey())
}
