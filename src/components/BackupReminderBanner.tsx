import { useEffect, useState } from 'react'
import type { AIProvider, AIMessage, ChecklistState, DayNotes, Trade } from '../types'
import { buildPayload, downloadBackup } from '../lib/backup'
import { dismissReminderForToday, getBackupReminder, markExported, type BackupReminder } from '../lib/backupReminder'

interface Props {
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  dayNotes: Record<string, DayNotes>
  aiConfig: { provider: AIProvider; apiKey: string; model: string }
  aiHistory: AIMessage[]
}

export default function BackupReminderBanner({ trades, checklists, dayNotes, aiConfig, aiHistory }: Props) {
  const [reminder, setReminder] = useState<BackupReminder>({ show: false, neverExported: true, daysSince: null })

  useEffect(() => {
    setReminder(getBackupReminder(trades))
  }, [trades])

  if (!reminder.show) return null

  function exportNow() {
    downloadBackup(
      buildPayload({ trades, checklists, dayNotes, aiConfig, aiHistory }),
    )
    markExported()
    setReminder(getBackupReminder(trades))
  }

  function later() {
    dismissReminderForToday()
    setReminder(getBackupReminder(trades))
  }

  return (
    <div className="card backup-reminder" role="alert">
      <div className="br-text">
        <b>
          {reminder.neverExported
            ? `⚠️ ${trades.length} trade${trades.length === 1 ? '' : 's'} and no backup yet`
            : `⚠️ Last backup was ${reminder.daysSince} day${reminder.daysSince === 1 ? '' : 's'} ago`}
        </b>
        <p className="sub">
          Your journal lives only in this browser — export a JSON copy so a cleared cache or new device doesn't wipe it.
        </p>
      </div>
      <div className="br-actions">
        <button type="button" className="btn primary" onClick={exportNow}>⬇ Export now</button>
        <button type="button" className="btn mini ghost" onClick={later}>Later</button>
      </div>
    </div>
  )
}
