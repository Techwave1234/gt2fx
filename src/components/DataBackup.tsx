import { useEffect, useRef, useState } from 'react'
import type { AIProvider, AIMessage, ChecklistState, DayNotes, Trade } from '../types'
import { backupFileName, buildPayload, downloadBackup, parseBackup, type BackupPayload } from '../lib/backup'
import { downloadCsv, tradesToCsv } from '../lib/csv'
import { checkSundayBackup, runSundayBackup, type SundayCheck } from '../lib/sundayBackup'
import { markExported } from '../lib/backupReminder'
import type { ImportPayload } from '../lib/importMerge'

interface AIConfigShape {
  provider: AIProvider
  apiKey: string
  model: string
}

interface Props {
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  dayNotes: Record<string, DayNotes>
  aiConfig: AIConfigShape
  aiHistory: AIMessage[]
  onImport: (data: ImportPayload, mode: 'replace' | 'merge') => void
  onClearAll: () => void
}

export default function DataBackup({ trades, checklists, dayNotes, aiConfig, aiHistory, onImport, onClearAll }: Props) {
  const [mode, setMode] = useState<'replace' | 'merge'>('merge')
  const [preview, setPreview] = useState<BackupPayload | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [justExported, setJustExported] = useState(false)
  const [justCsv, setJustCsv] = useState(false)
  const [autoState, setAutoState] = useState<SundayCheck | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sunday auto-backup: check once on mount; run when due (fresh Sundays with new trades)
  useEffect(() => {
    const check = checkSundayBackup(trades)
    setAutoState(check)
    if (check.due) {
      try {
        runSundayBackup({ trades, checklists, dayNotes, aiConfig, aiHistory, weekTrades: check.weekTrades })
      } catch {
        // download blocked — banner button below is the fallback
      }
      setAutoState(checkSundayBackup(trades))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function manualSundayRun() {
    try {
      runSundayBackup({ trades, checklists, dayNotes, aiConfig, aiHistory, weekTrades: autoState?.weekTrades ?? 0 })
    } catch {
      // ignore
    }
    setAutoState(checkSundayBackup(trades))
  }

  function handleExport() {
    downloadBackup(
      buildPayload({ trades, checklists, dayNotes, aiConfig, aiHistory }),
    )
    markExported()
    setJustExported(true)
    setTimeout(() => setJustExported(false), 2500)
  }

  function handleCsvExport() {
    downloadCsv(tradesToCsv(trades))
    setJustCsv(true)
    setTimeout(() => setJustCsv(false), 2500)
  }

  function handleFile(f: File) {
    setError(null)
    setPreview(null)
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseBackup(String(reader.result))
        setPreview(parsed)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not read that file.')
      }
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(f)
  }

  function confirmImport() {
    if (!preview) return
    onImport(
      {
        trades: preview.trades,
        checklists: preview.checklists,
        dayNotes: preview.dayNotes,
        aiConfig: mode === 'replace' ? preview.aiConfig : undefined,
        aiHistory: mode === 'replace' ? preview.aiHistory : undefined,
      },
      mode,
    )
    setPreview(null)
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const existingIds = new Set(trades.map(t => t.id))
  const dupCount = preview ? preview.trades.filter(t => existingIds.has(t.id)).length : 0

  return (
    <section className="card backup">
      <h2>Data & backup</h2>

      {autoState && autoState.isSunday && autoState.weekTrades > 0 && (
        <div className={`auto-banner ${autoState.alreadyRanToday ? 'done' : 'due'}`}>
          {autoState.alreadyRanToday ? (
            <span>✓ Sunday auto-backup saved today</span>
          ) : (
            <>
              <span>☀️ Sunday auto-backup — {autoState.weekTrades} new trade(s) this week</span>
              <button type="button" className="btn mini primary" onClick={manualSundayRun}>Back up now</button>
            </>
          )}
        </div>
      )}

      <div className="backup-row">
        <div>
          <p className="backup-stat">{trades.length} trades · {Object.keys(checklists).length} checklist days · {Object.keys(dayNotes).length} daily notes · {aiHistory.length} AI messages</p>
          <p className="sub">Everything lives in this browser only — export regularly to keep a copy safe.</p>
        </div>
        <div className="export-buttons">
          <button type="button" className="btn primary" onClick={handleExport}>
            {justExported ? '✓ Exported' : '⬇ Export JSON'}
          </button>
          <button type="button" className="btn ghost" onClick={handleCsvExport} disabled={trades.length === 0}>
            {justCsv ? '✓ CSV saved' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      <div className="backup-row import">
        <div className="import-controls">
          <label className={`dropzone ${fileName ? 'has-file' : ''}`}>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            {fileName ? `📄 ${fileName}` : '📄 Choose a backup file…'}
          </label>
          <div className="seg small">
            <button type="button" className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>Merge</button>
            <button type="button" className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>Replace</button>
          </div>
        </div>

        {error && <p className="import-error">⚠️ {error}</p>}

        {preview && (
          <div className="import-preview">
            <p>
              <b>{preview.trades.length}</b> trades · <b>{Object.keys(preview.checklists).length}</b> checklist days
              {preview.exportedAt && <> · exported {new Date(preview.exportedAt).toLocaleDateString()}</>}
              {dupCount > 0 && <> · {dupCount} look like duplicates of what you have</>}
            </p>
            <p className="sub">
              {mode === 'merge'
                ? 'Merge keeps both your current trades and the file\'s, skipping duplicates.'
                : 'Replace wipes your current journal and restores exactly what\'s in the file (including AI settings).'}
            </p>
            <div className="preview-actions">
              <button type="button" className="btn mini ghost" onClick={() => { setPreview(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}>
                Cancel
              </button>
              <button type="button" className={`btn mini ${mode === 'replace' ? 'danger' : 'primary'}`} onClick={confirmImport}>
                {mode === 'replace' ? 'Replace everything' : 'Merge into journal'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="danger-zone">
        <div>
          <p className="backup-stat">Clear all data</p>
          <p className="sub">Deletes every trade, checklist and AI chat on this device. Export first!</p>
        </div>
        {confirmClear ? (
          <div className="confirm-inline">
            <button type="button" className="btn mini ghost" onClick={() => setConfirmClear(false)}>Keep data</button>
            <button
              type="button"
              className="btn mini danger"
              onClick={() => {
                onClearAll()
                setConfirmClear(false)
              }}
            >
              Yes, delete all
            </button>
          </div>
        ) : (
          <button type="button" className="btn mini danger" onClick={() => setConfirmClear(true)}>Clear…</button>
        )}
      </div>
      <p className="sub file-name-hint">Exports save as <code>{backupFileName()}</code> or <code>gt2fx-journal-trades-YYYY-MM-DD.csv</code> · auto-backup runs every Sunday when the week has new trades.</p>
    </section>
  )
}
