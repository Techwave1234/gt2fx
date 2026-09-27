import type { AIProvider, Bias, ChecklistState, DayNotes, Trade } from '../types'
import { EMPTY_CHECKLIST } from '../types'

export interface BackupPayload {
  version: number
  exportedAt: string
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  dayNotes?: Record<string, DayNotes>
  aiConfig?: { provider: AIProvider; apiKey: string; model: string }
  aiHistory?: { id: string; role: 'user' | 'assistant'; content: string; at: number }[]
}

const RESULTS = ['win', 'loss', 'breakeven', 'open'] as const
const DIRECTIONS = ['long', 'short'] as const
const BIASES = ['bullish', 'bearish', 'range', ''] as const
const POI_VALUES = ['OB', 'FVG', 'Breaker', 'Liquidity sweep', 'Supply/Demand', 'SMT', 'Other']
const MODEL_VALUES = ['MSS / CHoCH', 'BOS retest', 'Displacement', 'Engulfing', 'SMT divergence', 'Silver bullet', 'Other']
const PROVIDERS = ['offline', 'openai', 'gemini', 'openrouter'] as const
const CHECKLIST_KEYS = ['followedPlan', 'respectedRisk', 'noRevenge', 'noOvertrade', 'journaled', 'stoppedAtLimit'] as const

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sanitizeTrade(raw: unknown): Trade | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : todayISO()

  const emotions = Array.isArray(r.emotions)
    ? r.emotions.filter((e): e is string => typeof e === 'string').slice(0, 12)
    : []

  const confidence = typeof r.confidence === 'number' && isFinite(r.confidence)
    ? Math.min(5, Math.max(1, Math.round(r.confidence)))
    : 3

  return {
    id: str(r.id) || genId(),
    date,
    time: /^\d{2}:\d{2}$/.test(str(r.time)) ? str(r.time) : '00:00',
    session: str(r.session, 'Other'),
    killzone: str(r.killzone).slice(0, 24),
    pair: str(r.pair, 'XAUUSD').toUpperCase().slice(0, 12),
    direction: DIRECTIONS.includes(r.direction as (typeof DIRECTIONS)[number])
      ? (r.direction as Trade['direction'])
      : 'long',
    setup: str(r.setup),
    biasHTF: BIASES.includes(r.biasHTF as (typeof BIASES)[number]) ? (r.biasHTF as Bias) : '',
    biasMTF: BIASES.includes(r.biasMTF as (typeof BIASES)[number]) ? (r.biasMTF as Bias) : '',
    biasLTF: BIASES.includes(r.biasLTF as (typeof BIASES)[number]) ? (r.biasLTF as Bias) : '',
    poi: POI_VALUES.includes(str(r.poi)) ? str(r.poi) : str(r.poi).slice(0, 40),
    entryModel: MODEL_VALUES.includes(str(r.entryModel)) ? str(r.entryModel) : str(r.entryModel).slice(0, 40),
    entry: numOrNull(r.entry),
    stopLoss: numOrNull(r.stopLoss),
    takeProfit: numOrNull(r.takeProfit),
    exit: numOrNull(r.exit),
    lots: numOrNull(r.lots),
    riskPercent: numOrNull(r.riskPercent),
    balance: numOrNull(r.balance),
    result: RESULTS.includes(r.result as (typeof RESULTS)[number])
      ? (r.result as Trade['result'])
      : 'open',
    confidence,
    emotions,
    notes: str(r.notes),
    lessons: str(r.lessons),
    entryReason: str(r.entryReason),
    exitReason: str(r.exitReason),
    followedPlan: r.followedPlan === true,
    screenshotUrl: str(r.screenshotUrl),
    createdAt: typeof r.createdAt === 'number' && isFinite(r.createdAt) ? r.createdAt : Date.now(),
  }
}

function sanitizeChecklist(raw: unknown): ChecklistState {
  const out: ChecklistState = { ...EMPTY_CHECKLIST }
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>
    for (const k of CHECKLIST_KEYS) out[k] = r[k] === true
  }
  return out
}

function sanitizeDayNotes(raw: unknown): Record<string, DayNotes> {
  const out: Record<string, DayNotes> = {}
  if (typeof raw === 'object' && raw !== null) {
    for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof value !== 'object' || value === null) continue
      const r = value as Record<string, unknown>
      out[date] = {
        riskPerTrade: numOrNull(r.riskPerTrade),
        biggestLearning: str(r.biggestLearning),
        planForTomorrow: str(r.planForTomorrow),
      }
    }
  }
  return out
}

function sanitizeChecklists(raw: unknown): Record<string, ChecklistState> {
  const out: Record<string, ChecklistState> = {}
  if (typeof raw === 'object' && raw !== null) {
    for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) out[date] = sanitizeChecklist(value)
    }
  }
  return out
}

function sanitizeAiConfig(raw: unknown): BackupPayload['aiConfig'] {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  return {
    provider: PROVIDERS.includes(r.provider as (typeof PROVIDERS)[number])
      ? (r.provider as AIProvider)
      : 'offline',
    apiKey: str(r.apiKey),
    model: str(r.model),
  }
}

function sanitizeAiHistory(raw: unknown): BackupPayload['aiHistory'] {
  if (!Array.isArray(raw)) return undefined
  const msgs = raw
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-200)
    .map(m => ({
      id: str(m.id) || genId(),
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      at: typeof m.at === 'number' && isFinite(m.at) ? m.at : Date.now(),
    }))
  return msgs
}

export function buildPayload(parts: {
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  dayNotes?: Record<string, DayNotes>
  aiConfig: { provider: AIProvider; apiKey: string; model: string }
  aiHistory: BackupPayload['aiHistory']
}): BackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    trades: parts.trades,
    checklists: parts.checklists,
    dayNotes: parts.dayNotes,
    aiConfig: parts.aiConfig,
    aiHistory: parts.aiHistory,
  }
}

export function backupFileName(suffix?: string): string {
  return `gt2fx-journal-backup-${todayISO()}${suffix ? `-${suffix}` : ''}.json`
}

export function downloadBackup(payload: BackupPayload, fileName?: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName ?? backupFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parse + sanitize a backup file's text. Throws Error with a friendly message when invalid. */
export function parseBackup(text: string): BackupPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Unexpected file structure — is this a GT2FX backup?')
  }
  const r = parsed as Record<string, unknown>
  if (!Array.isArray(r.trades)) {
    throw new Error('No trades found in this file — is this a GT2FX backup?')
  }
  const trades = r.trades.map(sanitizeTrade).filter((t): t is Trade => t !== null)
  return {
    version: typeof r.version === 'number' ? r.version : 1,
    exportedAt: str(r.exportedAt, todayISO()),
    trades,
    checklists: sanitizeChecklists(r.checklists),
    dayNotes: sanitizeDayNotes(r.dayNotes),
    aiConfig: sanitizeAiConfig(r.aiConfig),
    aiHistory: sanitizeAiHistory(r.aiHistory),
  }
}
