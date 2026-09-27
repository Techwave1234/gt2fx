export type Direction = 'long' | 'short'

export type TradeResult = 'win' | 'loss' | 'breakeven' | 'open'

/** Timeframe bias for top-down analysis. '' = not assessed */
export type Bias = 'bullish' | 'bearish' | 'range' | ''

export interface Trade {
  id: string
  /** ISO date, e.g. 2026-09-27 */
  date: string
  /** HH:MM 24h */
  time: string
  session: string
  /** ICT killzone id (see lib/killzones.ts), '' = none/custom */
  killzone: string
  pair: string
  direction: Direction
  setup: string
  /** Top-down analysis: higher timeframe bias (e.g. D1) */
  biasHTF: Bias
  /** Intermediate timeframe bias (e.g. H1) */
  biasMTF: Bias
  /** Lower timeframe / entry TF bias (e.g. M15) */
  biasLTF: Bias
  /** Point of interest type, e.g. OB, FVG, breaker */
  poi: string
  /** LTF entry model, e.g. MSS/CHoCH, BOS retest */
  entryModel: string
  entry: number | null
  stopLoss: number | null
  takeProfit: number | null
  exit: number | null
  lots: number | null
  /** Risk as % of account, e.g. 1 */
  riskPercent: number | null
  /** Account balance at time of trade */
  balance: number | null
  result: TradeResult
  /** Confidence 1-5 */
  confidence: number
  emotions: string[]
  notes: string
  lessons: string
  /** Why did you take the trade (paper: "Entry Reason") */
  entryReason: string
  /** Why did you close it (paper: "Exit Reason") */
  exitReason: string
  /** Paper: "Followed plan? (Yes/No)" per trade */
  followedPlan: boolean
  screenshotUrl: string
  createdAt: number
}

/** Per-day fields from the paper journal sheet */
export interface DayNotes {
  /** Paper header: "Risk Per Trade: ___" (in %) */
  riskPerTrade: number | null
  /** Paper: "Today's Biggest Learning" */
  biggestLearning: string
  /** Paper: "Plan for Tomorrow" */
  planForTomorrow: string
}

export interface ChecklistState {
  followedPlan: boolean
  respectedRisk: boolean
  noRevenge: boolean
  noOvertrade: boolean
  journaled: boolean
  stoppedAtLimit: boolean
}

export interface JournalState {
  trades: Trade[]
  checklists: Record<string, ChecklistState>
  /** Per-day paper-sheet fields (risk per trade, biggest learning, plan for tomorrow) */
  dayNotes: Record<string, DayNotes>
  aiConfig: AIConfig
  aiHistory: AIMessage[]
}

export type AIProvider = 'offline' | 'openai' | 'gemini' | 'openrouter'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: number
}

export const EMOTION_OPTIONS = [
  'calm',
  'confident',
  'fomo',
  'fearful',
  'greedy',
  'impatient',
  'revengeful',
  'bored',
] as const

export const SESSION_OPTIONS = ['Asia', 'London', 'New York', 'Overlap', 'Other'] as const

export const BIAS_OPTIONS: Exclude<Bias, ''>[] = ['bullish', 'bearish', 'range']

export const POI_OPTIONS = [
  'OB',
  'FVG',
  'Breaker',
  'Liquidity sweep',
  'Supply/Demand',
  'SMT',
  'Other',
] as const

export const MODEL_OPTIONS = [
  'MSS / CHoCH',
  'BOS retest',
  'Displacement',
  'Engulfing',
  'SMT divergence',
  'Silver bullet',
  'Other',
] as const

/** Map of bias → label + color class used across the UI */
export const BIAS_LABEL: Record<Exclude<Bias, ''>, string> = {
  bullish: '▲',
  bearish: '▼',
  range: '▬',
}

export const CHECKLIST_ITEMS: { key: keyof ChecklistState; label: string }[] = [
  { key: 'followedPlan', label: 'Followed my plan' },
  { key: 'respectedRisk', label: 'Respected risk rules' },
  { key: 'noRevenge', label: 'No revenge trading' },
  { key: 'noOvertrade', label: 'No overtrading' },
  { key: 'journaled', label: 'Journaled every trade' },
  { key: 'stoppedAtLimit', label: 'Stopped at daily limit' },
]

export const EMPTY_CHECKLIST: ChecklistState = {
  followedPlan: false,
  respectedRisk: false,
  noRevenge: false,
  noOvertrade: false,
  journaled: false,
  stoppedAtLimit: false,
}

export const EMPTY_DAY_NOTES: DayNotes = {
  riskPerTrade: null,
  biggestLearning: '',
  planForTomorrow: '',
}
