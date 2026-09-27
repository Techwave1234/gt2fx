import { useCallback, useEffect, useState } from 'react'
import type { ChecklistState, DayNotes, JournalState, Trade } from '../types'
import { EMPTY_CHECKLIST, EMPTY_DAY_NOTES } from '../types'
import { applyClear, applyImport, type ImportPayload } from '../lib/importMerge'

const STORAGE_KEY = 'gt2fx.journal.v1'

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function emptyState(): JournalState {
  return { trades: [], checklists: {}, dayNotes: {}, aiConfig: { provider: 'offline', apiKey: '', model: '' }, aiHistory: [] }
}

function load(): JournalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<JournalState>
    return {
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      checklists: parsed.checklists ?? {},
      dayNotes: parsed.dayNotes ?? {},
      aiConfig: { provider: 'offline', apiKey: '', model: '', ...parsed.aiConfig },
      aiHistory: Array.isArray(parsed.aiHistory) ? parsed.aiHistory : [],
    }
  } catch {
    return emptyState()
  }
}

export function newTradeDefaults(): Trade {
  return {
    id: cryptoId(),
    date: todayKey(),
    time: new Date().toTimeString().slice(0, 5),
    session: 'London',
    killzone: '',
    pair: 'XAUUSD',
    direction: 'long',
    setup: '',
    biasHTF: '',
    biasMTF: '',
    biasLTF: '',
    poi: '',
    entryModel: '',
    entry: null,
    stopLoss: null,
    takeProfit: null,
    exit: null,
    lots: null,
    riskPercent: 1,
    balance: null,
    result: 'open',
    confidence: 3,
    emotions: [],
    notes: '',
    lessons: '',
    screenshotUrl: '',
    entryReason: '',
    exitReason: '',
    followedPlan: false,
    createdAt: Date.now(),
  }
}

export function useJournal() {
  const [state, setState] = useState<JournalState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full / private mode — ignore
    }
  }, [state])

  const addTrade = useCallback((t: Trade) => {
    setState(s => ({ ...s, trades: [{ ...t, createdAt: Date.now() }, ...s.trades] }))
  }, [])

  const updateTrade = useCallback((id: string, patch: Partial<Trade>) => {
    setState(s => ({
      ...s,
      trades: s.trades.map(t => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  const deleteTrade = useCallback((id: string) => {
    setState(s => ({ ...s, trades: s.trades.filter(t => t.id !== id) }))
  }, [])

  const getChecklist = useCallback(
    (date: string): ChecklistState => state.checklists[date] ?? EMPTY_CHECKLIST,
    [state.checklists],
  )

  const setChecklistItem = useCallback((date: string, key: keyof ChecklistState, value: boolean) => {
    setState(s => ({
      ...s,
      checklists: { ...s.checklists, [date]: { ...(s.checklists[date] ?? EMPTY_CHECKLIST), [key]: value } },
    }))
  }, [])

  const setAIConfig = useCallback((patch: Partial<JournalState['aiConfig']>) => {
    setState(s => ({ ...s, aiConfig: { ...s.aiConfig, ...patch } }))
  }, [])

  const setAIHistory = useCallback((history: JournalState['aiHistory']) => {
    setState(s => ({ ...s, aiHistory: history.slice(-60) }))
  }, [])

  const getDayNotes = useCallback(
    (date: string): DayNotes => state.dayNotes[date] ?? EMPTY_DAY_NOTES,
    [state.dayNotes],
  )

  const setDayNotes = useCallback((date: string, patch: Partial<DayNotes>) => {
    setState(s => ({
      ...s,
      dayNotes: { ...s.dayNotes, [date]: { ...(s.dayNotes[date] ?? EMPTY_DAY_NOTES), ...patch } },
    }))
  }, [])

  /** Restore from a backup. mode 'replace' wipes current data first; 'merge' merges by id/date keeping newest. */
  const importData = useCallback(
    (data: ImportPayload, mode: 'replace' | 'merge') => {
      setState(s => applyImport(s, data, mode))
    },
    [],
  )

  /** Wipe all journal data (trades, checklists, AI history); keeps AI provider settings. */
  const clearAll = useCallback(() => {
    setState(s => applyClear(s))
  }, [])

  const today = todayKey()
  const todaysTrades = state.trades.filter(t => t.date === today)

  return {
    trades: state.trades,
    todaysTrades,
    checklists: state.checklists,
    dayNotes: state.dayNotes,
    getDayNotes,
    setDayNotes,
    addTrade,
    updateTrade,
    deleteTrade,
    getChecklist,
    setChecklistItem,
    aiConfig: state.aiConfig,
    setAIConfig,
    aiHistory: state.aiHistory,
    setAIHistory,
    importData,
    clearAll,
  }
}
