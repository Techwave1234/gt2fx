import { useEffect, useMemo, useState } from 'react'
import type { ChecklistState, Trade } from './types'
import { useJournal } from './hooks/useJournal'
import TradeForm from './components/TradeForm'
import TradeCard from './components/TradeCard'
import DailySummary from './components/DailySummary'
import StatsBar from './components/StatsBar'
import WeeklyReview from './components/WeeklyReview'
import DataBackup from './components/DataBackup'
import BackupReminderBanner from './components/BackupReminderBanner'
import PrintableSheet from './components/PrintableSheet'
import KillzoneClock from './components/KillzoneClock'
import Confetti from './components/Confetti'
import AICoach from './components/AICoach'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type ResultFilter = 'all' | 'win' | 'loss' | 'breakeven' | 'open'

export default function App() {
  const journal = useJournal()
  const [formOpen, setFormOpen] = useState(false)
  const [prefill, setPrefill] = useState<Partial<Trade> | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [tab, setTab] = useState<'journal' | 'review'>('journal')
  const [celebrating, setCelebrating] = useState(false)
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>(`today`)
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [query, setQuery] = useState('')

  const today = todayKey()

  const visibleTrades = useMemo(() => {
    let list = journal.trades
    if (dateFilter === 'today') list = list.filter(t => t.date === today)
    if (resultFilter !== 'all') list = list.filter(t => t.result === resultFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(t =>
        [t.pair, t.setup, t.notes, t.lessons, t.session].some(v => v.toLowerCase().includes(q)),
      )
    }
    return list
  }, [journal.trades, dateFilter, resultFilter, query, today])

  function openNewForm(patch?: Partial<Trade>) {
    setPrefill(patch ?? null)
    setFormOpen(true)
  }

  function saveTrade(t: Trade) {
    if (journal.trades.some(x => x.id === t.id)) {
      journal.updateTrade(t.id, t)
    } else {
      journal.addTrade(t)
    }
  }

  function toggleChecklist(key: keyof ChecklistState, value: boolean) {
    journal.setChecklistItem(today, key, value)
  }

  /** Consecutive days (ending today or yesterday) with the full checklist complete */
  const disciplineStreak = useMemo(() => {
    const ALL = 6
    const complete = (d: Date): boolean => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const cl = journal.checklists[key]
      if (!cl) return false
      return Object.values(cl).filter(Boolean).length === ALL
    }
    let current = 0
    const cursor = new Date()
    // today counts only if already complete; otherwise streak counts back from yesterday
    if (complete(cursor)) current++
    for (;;) {
      cursor.setDate(cursor.getDate() - 1)
      if (complete(cursor)) current++
      else break
    }
    // best: walk all recorded checklist days
    const days = Object.entries(journal.checklists)
      .filter(([, cl]) => Object.values(cl).filter(Boolean).length === ALL)
      .map(([key]) => key)
      .sort()
    let best = 0
    let run = 0
    let prev: Date | null = null
    for (const key of days) {
      const d = new Date(`${key}T00:00:00`)
      const consecutive = prev !== null && d.getTime() - prev.getTime() === 86400000
      run = consecutive ? run + 1 : 1
      best = Math.max(best, run)
      prev = d
    }
    // today/yesterday run may exceed the historical best if it's still growing
    if (current > best) best = current
    return { current, best }
  }, [journal.checklists])

  /** Track the best streak ever seen so a new record fires exactly once */
  const [recordStreak, setRecordStreak] = useState<number | null>(null)
  useEffect(() => {
    if (disciplineStreak.current > 0 && disciplineStreak.current > (recordStreak ?? 0)) {
      setRecordStreak(disciplineStreak.current)
      setCelebrating(true)
      // Sound-free haptic buzz (Android; silently unsupported on iOS Safari)
      try {
        navigator.vibrate?.([40, 60, 40, 60, 110])
      } catch {
        /* no haptics available — confetti is enough */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplineStreak.current])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">📓</span>
          <div>
            <h1>GT2FX Journal</h1>
            <p className="sub">Discipline · Risk · Review</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Views">
          <button type="button" className={tab === 'journal' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('journal')}>Journal</button>
          <button type="button" className={tab === 'review' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('review')}>Review</button>
        </nav>
      </header>

      <main>
        <BackupReminderBanner
          trades={journal.trades}
          checklists={journal.checklists}
          dayNotes={journal.dayNotes}
          aiConfig={journal.aiConfig}
          aiHistory={journal.aiHistory}
        />
        <KillzoneClock />
        {tab === 'review' ? (
          <WeeklyReview trades={journal.trades} />
        ) : (
          <>
            <DailySummary
          date={today}
          trades={journal.todaysTrades}
          checklist={journal.getChecklist(today)}
          dayNotes={journal.getDayNotes(today)}
          onToggle={toggleChecklist}
          onDayNotes={patch => journal.setDayNotes(today, patch)}
          onNewTrade={() => openNewForm()}
          onPrint={() => window.print()}
          streak={disciplineStreak}
        />

        <StatsBar trades={journal.trades} />

        <section className="card list-card">
          <header className="list-head">
            <h2>Trades</h2>
            <div className="filters">
              <div className="seg small">
                <button type="button" className={dateFilter === 'today' ? 'active' : ''} onClick={() => setDateFilter('today')}>Today</button>
                <button type="button" className={dateFilter === 'all' ? 'active' : ''} onClick={() => setDateFilter('all')}>All</button>
              </div>
              <select value={resultFilter} onChange={e => setResultFilter(e.target.value as ResultFilter)}>
                <option value="all">All results</option>
                <option value="win">Wins</option>
                <option value="loss">Losses</option>
                <option value="breakeven">Breakeven</option>
                <option value="open">Open</option>
              </select>
              <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" />
            </div>
          </header>

          {visibleTrades.length === 0 ? (
            <p className="empty">
              {journal.trades.length === 0
                ? 'No trades yet — log your first one, or ask the AI coach to fill it for you.'
                : 'No trades match these filters.'}
            </p>
          ) : (
            <div className="trade-list">
              {visibleTrades.map((t, i) => (
                <TradeCard key={t.id} trade={t} index={i + 1} onUpdate={journal.updateTrade} onDelete={journal.deleteTrade} />
              ))}
            </div>
          )}
        </section>

        <DataBackup
          trades={journal.trades}
          checklists={journal.checklists}
          dayNotes={journal.dayNotes}
          aiConfig={journal.aiConfig}
          aiHistory={journal.aiHistory}
          onImport={journal.importData}
          onClearAll={journal.clearAll}
        />
          </>
        )}
      </main>

      {celebrating && <Confetti onDone={() => setCelebrating(false)} />}

      {/* Hidden printable sheet — only appears when printing */}
      <div className="print-root" aria-hidden>
        <PrintableSheet
          date={today}
          trades={journal.todaysTrades}
          checklist={journal.getChecklist(today)}
          dayNotes={journal.getDayNotes(today)}
        />
      </div>

      <TradeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={saveTrade}
        prefill={prefill}
        enforce={journal.preTradeEnforce}
        onToggleEnforce={journal.setPreTradeEnforce}
      />

      <AICoach
        open={aiOpen}
        onOpenChange={setAiOpen}
        trades={journal.trades}
        checklist={journal.getChecklist(today)}
        aiConfig={journal.aiConfig}
        onConfigChange={journal.setAIConfig}
        history={journal.aiHistory}
        onHistoryChange={journal.setAIHistory}
        onFill={patch => {
          setAiOpen(false)
          openNewForm(patch)
        }}
      />
    </div>
  )
}
