import type { Trade, TradeResult } from '../types'
import { pairSpec } from './pairs'

export interface TradeCalc {
  /** Planned risk in price distance (absolute) */
  riskDistance: number | null
  /** Planned reward in price distance (absolute) */
  rewardDistance: number | null
  /** Reward-to-risk ratio, e.g. 2.5 */
  rr: number | null
  /** Risk amount in account currency based on riskPercent × balance */
  riskAmount: number | null
  /** Planned reward in $ = risk × R:R (paper: "Reward") */
  plannedReward: number | null
  /** Realized P/L in account currency (direction-aware, when exit given) */
  pnl: number | null
  /** Realized R-multiple, e.g. 1.8 or -1 */
  rMultiple: number | null
  /** Lot size that risks riskAmount over the SL distance (per 1.0 lot = 100k units, quote→USD approximated) */
  suggestedLots: number | null
}

/** Pip size for any known pair (falls back to FX default 0.0001) */
export function pipSize(pair: string): number {
  return pairSpec(pair)?.pipSize ?? 0.0001
}

/** Approx USD pip value per 1.0 lot for any known pair (fallback 10) */
export function pipValueUsd(pair: string): number {
  return pairSpec(pair)?.pipValue ?? 10
}

export function pipsBetween(pair: string, a: number, b: number): number {
  return Math.abs(a - b) / pipSize(pair)
}

function dist(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !isFinite(a) || !isFinite(b)) return null
  return Math.abs(a - b)
}

export function calcTrade(t: Trade): TradeCalc {
  const riskDistance = dist(t.entry, t.stopLoss)
  const rewardDistance = dist(t.entry, t.takeProfit)
  const rr =
    riskDistance && rewardDistance && riskDistance > 0
      ? rewardDistance / riskDistance
      : null
  const riskAmount =
    t.riskPercent && t.balance ? (t.riskPercent / 100) * t.balance : null

  // Suggested lot size: riskAmount / (SL pips × pip value per lot)
  let suggestedLots: number | null = null
  if (riskAmount && t.entry !== null && t.stopLoss !== null && t.pair) {
    const slPips = pipsBetween(t.pair, t.entry, t.stopLoss)
    if (slPips > 0) {
      const raw = riskAmount / (slPips * pipValueUsd(t.pair))
      suggestedLots = Math.max(0.01, Math.round(raw * 100) / 100)
    }
  }

  let pnl: number | null = null
  let rMultiple: number | null = null
  if (
    t.exit !== null &&
    t.entry !== null &&
    t.lots !== null &&
    t.result !== 'open'
  ) {
    const signed =
      t.direction === 'long' ? t.exit - t.entry : t.entry - t.exit
    const slPips = t.stopLoss !== null ? pipsBetween(t.pair, t.entry, t.stopLoss) : null
    const movePips = Math.abs(signed) / pipSize(t.pair)
    pnl = signed * t.lots * pipValueUsd(t.pair)
    if (slPips && slPips > 0) rMultiple = movePips / slPips * Math.sign(signed || 1)
  }

  const plannedReward = riskAmount !== null && rr !== null ? riskAmount * rr : null

  return { riskDistance, rewardDistance, rr, riskAmount, plannedReward, pnl, rMultiple, suggestedLots }
}

export function fmtMoney(n: number | null, digits = 2): string {
  if (n === null || !isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toFixed(digits)}`
}

export function fmtNum(n: number | null, digits = 2): string {
  if (n === null || !isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function fmtR(n: number | null): string {
  if (n === null || !isFinite(n)) return '—'
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}R`
}

export interface DailyStats {
  wins: number
  losses: number
  breakeven: number
  netPnl: number
  netR: number
}

export function summarize(trades: Trade[]): DailyStats {
  let wins = 0, losses = 0, breakeven = 0, netPnl = 0, netR = 0
  for (const t of trades) {
    const c = calcTrade(t)
    if (t.result === 'win') wins++
    else if (t.result === 'loss') losses++
    else if (t.result === 'breakeven') breakeven++
    if (c.pnl !== null) netPnl += c.pnl
    if (c.rMultiple !== null) netR += c.rMultiple
  }
  return { wins, losses, breakeven, netPnl, netR }
}

export function resultColor(r: TradeResult): string {
  switch (r) {
    case 'win': return 'var(--green)'
    case 'loss': return 'var(--red)'
    case 'breakeven': return 'var(--amber)'
    case 'open': return 'var(--blue)'
  }
}
