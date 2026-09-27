import type { ChecklistState, DayNotes, JournalState, Trade } from '../types'
import { EMPTY_CHECKLIST, EMPTY_DAY_NOTES } from '../types'

export interface ImportPayload {
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  dayNotes?: Record<string, DayNotes>
  aiConfig?: JournalState['aiConfig']
  aiHistory?: JournalState['aiHistory']
}

export function applyClear(s: JournalState): JournalState {
  return { trades: [], checklists: {}, dayNotes: {}, aiConfig: s.aiConfig, aiHistory: [] }
}

export function applyImport(s: JournalState, data: ImportPayload, mode: 'replace' | 'merge'): JournalState {
  if (mode === 'replace') {
    return {
      trades: [...data.trades].sort((a, b) => b.createdAt - a.createdAt),
      checklists: data.checklists,
      dayNotes: data.dayNotes ?? {},
      aiConfig: data.aiConfig ?? s.aiConfig,
      aiHistory: data.aiHistory ?? [],
    }
  }

  // merge trades by id, then by (date+time+pair+direction+entry) to avoid duplicates
  const byId = new Map<string, Trade>()
  const byKey = new Map<string, Trade>()
  const keyOf = (t: Trade) => `${t.date}|${t.time}|${t.pair}|${t.direction}|${t.entry ?? ''}`
  const put = (t: Trade) => {
    const existing = byId.get(t.id)
    if (!existing || t.createdAt >= existing.createdAt) byId.set(t.id, t)
    const key = keyOf(t)
    const ex2 = byKey.get(key)
    if (!ex2 || t.createdAt >= ex2.createdAt) byKey.set(key, t)
  }
  for (const t of s.trades) put(t)
  for (const t of data.trades) put(t)

  // Build final list: prefer id-dedup, fall back to composite-key dedup
  const seen = new Set<string>()
  const merged: Trade[] = []
  for (const t of [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = keyOf(t)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(t)
  }

  const checklists: Record<string, ChecklistState> = { ...s.checklists }
  for (const [date, cl] of Object.entries(data.checklists)) {
    const cur = checklists[date] ?? { ...EMPTY_CHECKLIST }
    checklists[date] = {
      followedPlan: cl.followedPlan || cur.followedPlan,
      respectedRisk: cl.respectedRisk || cur.respectedRisk,
      noRevenge: cl.noRevenge || cur.noRevenge,
      noOvertrade: cl.noOvertrade || cur.noOvertrade,
      journaled: cl.journaled || cur.journaled,
      stoppedAtLimit: cl.stoppedAtLimit || cur.stoppedAtLimit,
    }
  }

  const notes: Record<string, DayNotes> = { ...s.dayNotes }
  for (const [date, dn] of Object.entries(data.dayNotes ?? {})) {
    const cur = notes[date] ?? EMPTY_DAY_NOTES
    notes[date] = {
      riskPerTrade: dn.riskPerTrade ?? cur.riskPerTrade,
      biggestLearning: dn.biggestLearning || cur.biggestLearning,
      planForTomorrow: dn.planForTomorrow || cur.planForTomorrow,
    }
  }

  return {
    trades: merged,
    checklists,
    dayNotes: notes,
    aiConfig: s.aiConfig,
    aiHistory: s.aiHistory,
  }
}
