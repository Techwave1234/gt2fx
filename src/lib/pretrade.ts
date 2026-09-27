import type { Trade } from '../types'
import { calcTrade } from './calc'

export type Alignment = 'ok' | 'partial' | 'counter' | 'none'

/** Are HTF/MTF/LTF all pointing the same way as the trade? */
export function alignmentOf(t: Trade): Alignment {
  if (!t.biasHTF || !t.biasMTF || !t.biasLTF) return 'none'
  const dirBull = t.direction === 'long'
  const agree = (b: Trade['biasHTF']) => b === (dirBull ? 'bullish' : 'bearish')
  const oppose = (b: Trade['biasHTF']) => b === (dirBull ? 'bearish' : 'bullish')
  if (agree(t.biasHTF) && agree(t.biasMTF) && agree(t.biasLTF)) return 'ok'
  if (oppose(t.biasHTF)) return 'counter'
  // 'range' HTF or mixed-but-not-opposing: a caution, not a counter-trend red flag
  return 'partial'
}

export interface PreTradeCheck {
  id: string
  label: string
  test: (t: Trade) => boolean
}

/** Auto-evaluated from the trade itself — nothing to tick manually. */
export const PRETRADE_CHECKS: PreTradeCheck[] = [
  { id: 'htf', label: 'HTF bias defined', test: t => t.biasHTF !== '' },
  { id: 'aligned', label: 'Timeframes aligned with direction', test: t => alignmentOf(t) === 'ok' },
  { id: 'sl', label: 'Stop loss set', test: t => t.stopLoss !== null },
  {
    id: 'rr',
    label: 'R:R at least 1:1.5',
    test: t => {
      const c = calcTrade(t)
      return c.rr !== null && c.rr >= 1.5
    },
  },
  { id: 'risk', label: 'Risk 2% or less', test: t => t.riskPercent === null || t.riskPercent <= 2 },
  { id: 'kz', label: 'Killzone selected', test: t => t.killzone !== '' },
  { id: 'poi', label: 'POI marked', test: t => t.poi.trim() !== '' },
  { id: 'reason', label: 'Entry reason written (5+ chars)', test: t => t.entryReason.trim().length >= 5 },
]

export interface PreTradeResult {
  check: PreTradeCheck
  pass: boolean
}

export function evalPreTrade(t: Trade): PreTradeResult[] {
  return PRETRADE_CHECKS.map(c => ({ check: c, pass: c.test(t) }))
}
