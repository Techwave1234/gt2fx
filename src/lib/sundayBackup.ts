import type { ChecklistState, DayNotes, Trade } from '../types'
import { backupFileName, buildPayload, downloadBackup, type BackupPayload } from './backup'
import { markExported } from './backupReminder'

const LAST_RUN_KEY = 'gt2fx.autobackup.lastrun'

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Monday 00:00 of the current week (local time) */
function weekStart(d = new Date()): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return date
}

export interface SundayCheck {
  /** It's Sunday, not yet run today, and there are new trades this week */
  due: boolean
  isSunday: boolean
  alreadyRanToday: boolean
  /** Trades created since Monday */
  weekTrades: number
}

/** Dev/testing escape hatch: append ?simulate=sunday to the URL to treat today as Sunday. */
function simulateSunday(): boolean {
  if (typeof location === 'undefined') return false
  try {
    return new URLSearchParams(location.search).has('simulate-sunday')
  } catch {
    return false
  }
}

export function checkSundayBackup(trades: Trade[]): SundayCheck {
  const now = new Date()
  const isSunday = now.getDay() === 0 || simulateSunday()
  const lastRun = localStorage.getItem(LAST_RUN_KEY)
  const alreadyRanToday = lastRun === todayKey(now)
  const start = weekStart(now).getTime()
  const weekTrades = trades.filter(t => t.createdAt >= start).length
  return {
    due: isSunday && !alreadyRanToday && weekTrades > 0,
    isSunday,
    alreadyRanToday,
    weekTrades,
  }
}

export interface AutoBackupPayload {
  payload: BackupPayload
  fileName: string
  weekTrades: number
}

/**
 * Build + download the Sunday auto-backup.
 * Note: browsers may block programmatic downloads without a user gesture —
 * the UI shows a banner with a manual button as a fallback.
 */
export function runSundayBackup(parts: {
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  dayNotes: Record<string, DayNotes>
  aiConfig: { provider: string; apiKey: string; model: string }
  aiHistory: BackupPayload['aiHistory']
  weekTrades: number
}): AutoBackupPayload {
  const payload = buildPayload({
    trades: parts.trades,
    checklists: parts.checklists,
    dayNotes: parts.dayNotes,
    aiConfig: parts.aiConfig as BackupPayload['aiConfig'],
    aiHistory: parts.aiHistory,
  })
  const fileName = backupFileName('auto-sunday')
  downloadBackup(payload, fileName)
  localStorage.setItem(LAST_RUN_KEY, todayKey())
  markExported()
  return { payload, fileName, weekTrades: parts.weekTrades }
}
