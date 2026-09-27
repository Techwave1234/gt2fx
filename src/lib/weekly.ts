import type { Trade } from '../types'
import type { TradeCalc } from './calc'
import { calcTrade } from './calc'
import { killzoneById } from './killzones'

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7)
}

/** Monday-based week start, local time */
export function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return date
}

export function weekLabel(start: Date): string {
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return `${fmt.format(start)} – ${fmt.format(addDays(start, 6))}`
}

export interface GroupStat {
  key: string
  count: number
  wins: number
  losses: number
  breakeven: number
  winRate: number | null
  netPnl: number
  netR: number
  rCount: number
  avgR: number | null
}

export interface DayStat {
  date: string
  label: string
  count: number
  pnl: number | null
}

export interface RBucket {
  label: string
  count: number
  tone: 'bad' | 'warn' | 'good'
}

export interface RSummary {
  counted: number
  avgWinR: number | null
  avgLossR: number | null
  bestR: number | null
  worstR: number | null
  buckets: RBucket[]
}

export interface WeekAnalysis {
  label: string
  total: number
  closedCount: number
  openCount: number
  wins: number
  losses: number
  breakeven: number
  winRate: number | null
  netPnl: number
  netR: number
  bySetup: GroupStat[]
  byEmotion: GroupStat[]
  byKillzone: GroupStat[]
  byPair: GroupStat[]
  byDay: DayStat[]
  /** Closed trades in this week (for R-multiple analysis) */
  closedTrades: Trade[]
  tradingDays: number
  greenDays: number
  redDays: number
}

function emptyGroup(key: string): GroupStat {
  return { key, count: 0, wins: 0, losses: 0, breakeven: 0, winRate: null, netPnl: 0, netR: 0, rCount: 0, avgR: null }
}

function addTrade(g: GroupStat, t: Trade, c: TradeCalc): void {
  g.count++
  if (t.result === 'win') g.wins++
  else if (t.result === 'loss') g.losses++
  else if (t.result === 'breakeven') g.breakeven++
  if (c.pnl !== null) g.netPnl += c.pnl
  if (c.rMultiple !== null) {
    g.netR += c.rMultiple
    g.rCount++
  }
}

function finalizeGroups(map: Map<string, GroupStat>, sortBy: 'pnl' | 'count'): GroupStat[] {
  return [...map.values()]
    .map(g => {
      const decided = g.wins + g.losses
      g.winRate = decided ? g.wins / decided : null
      g.avgR = g.rCount ? g.netR / g.rCount : null
      return g
    })
    .sort((a, b) => (sortBy === 'pnl' ? b.netPnl - a.netPnl : b.count - a.count))
}

export function analyzeWeek(allTrades: Trade[], weekStart: Date): WeekAnalysis {
  const end = addWeeks(weekStart, 1)
  const inWeek = allTrades.filter(t => {
    const d = new Date(`${t.date}T00:00:00`)
    return d >= weekStart && d < end
  })
  const closed = inWeek.filter(t => t.result !== 'open')

  let wins = 0, losses = 0, breakeven = 0, netPnl = 0, netR = 0
  const setups = new Map<string, GroupStat>()
  const emotions = new Map<string, GroupStat>()
  const killzones = new Map<string, GroupStat>()
  const pairs = new Map<string, GroupStat>()
  const pnlByDate = new Map<string, number>()

  for (const t of closed) {
    if (t.result === 'win') wins++
    else if (t.result === 'loss') losses++
    else if (t.result === 'breakeven') breakeven++
    const c = calcTrade(t)
    if (c.pnl !== null) {
      netPnl += c.pnl
      pnlByDate.set(t.date, (pnlByDate.get(t.date) ?? 0) + c.pnl)
    }
    if (c.rMultiple !== null) netR += c.rMultiple

    const setupKey = t.setup.trim() || 'Untagged'
    const sg = setups.get(setupKey) ?? emptyGroup(setupKey)
    addTrade(sg, t, c)
    setups.set(setupKey, sg)

    for (const e of t.emotions) {
      const eg = emotions.get(e) ?? emptyGroup(e)
      addTrade(eg, t, c)
      emotions.set(e, eg)
    }

    const kzKey = (t.killzone && killzoneById(t.killzone)?.label) || 'No killzone'
    const kg = killzones.get(kzKey) ?? emptyGroup(kzKey)
    addTrade(kg, t, c)
    killzones.set(kzKey, kg)

    const pairKey = t.pair || 'Unknown'
    const pg = pairs.get(pairKey) ?? emptyGroup(pairKey)
    addTrade(pg, t, c)
    pairs.set(pairKey, pg)
  }

  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  const byDay: DayStat[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    const iso = toISODate(d)
    const count = inWeek.filter(t => t.date === iso).length
    const pnl = pnlByDate.get(iso)
    byDay.push({ date: iso, label: dayFmt.format(d), count, pnl: pnl !== undefined ? pnl : null })
  }

  const decided = wins + losses
  return {
    label: weekLabel(weekStart),
    total: inWeek.length,
    closedCount: closed.length,
    openCount: inWeek.length - closed.length,
    wins,
    losses,
    breakeven,
    winRate: decided ? wins / decided : null,
    netPnl,
    netR,
    bySetup: finalizeGroups(setups, 'pnl'),
    byEmotion: finalizeGroups(emotions, 'count'),
    byKillzone: finalizeGroups(killzones, 'count'),
    byPair: finalizeGroups(pairs, 'pnl'),
    byDay,
    closedTrades: closed,
    tradingDays: byDay.filter(d => d.count > 0).length,
    greenDays: byDay.filter(d => (d.pnl ?? 0) > 0).length,
    redDays: byDay.filter(d => (d.pnl ?? 0) < 0).length,
  }
}

export interface EmotionImpactRow {
  key: string
  /** Trades with a measurable R carrying this tag */
  count: number
  avgR: number
}

export interface EmotionImpact {
  rows: EmotionImpactRow[]
  /** Average R of trades with NO emotion tags (the unemotional baseline) */
  baseAvg: number | null
  baseCount: number
}

/** Average R per emotion tag + untagged baseline, worst first. */
export function emotionImpactOf(closedTrades: Trade[]): EmotionImpact {
  const acc = new Map<string, { count: number; rSum: number; rN: number }>()
  let baseRSum = 0, baseRN = 0, baseCount = 0
  for (const t of closedTrades) {
    const r = calcTrade(t).rMultiple
    if (r === null || !isFinite(r)) continue
    if (t.emotions.length === 0) {
      baseCount++
      baseRSum += r
      baseRN++
      continue
    }
    for (const e of t.emotions) {
      const a = acc.get(e) ?? { count: 0, rSum: 0, rN: 0 }
      a.count++
      a.rSum += r
      a.rN++
      acc.set(e, a)
    }
  }
  const rows = [...acc.entries()]
    .filter(([, v]) => v.rN > 0)
    .map(([key, v]) => ({ key, count: v.count, avgR: v.rSum / v.rN }))
    .sort((x, y) => x.avgR - y.avgR)
  return { rows, baseAvg: baseRN ? baseRSum / baseRN : null, baseCount }
}

const R_BUCKETS: { label: string; tone: RBucket['tone']; test: (r: number) => boolean }[] = [
  { label: '≤−2R', tone: 'bad', test: r => r <= -2 },
  { label: '−2…−1', tone: 'bad', test: r => r >= -2 && r < -1 },
  { label: '−1…−½', tone: 'bad', test: r => r >= -1 && r < -0.5 },
  { label: '−½…0', tone: 'bad', test: r => r >= -0.5 && r <= -0.005 },
  { label: 'BE', tone: 'warn', test: r => Math.abs(r) < 0.005 },
  { label: '0…+1', tone: 'good', test: r => r >= 0.005 && r < 1 },
  { label: '+1…+2', tone: 'good', test: r => r >= 1 && r < 2 },
  { label: '+2…+3', tone: 'good', test: r => r >= 2 && r < 3 },
  { label: '≥+3R', tone: 'good', test: r => r >= 3 },
]

/** R-multiple distribution across buckets + summary stats for the given (closed) trades */
export function rDistribution(trades: Trade[]): RSummary {
  const rs: number[] = []
  for (const t of trades) {
    const r = calcTrade(t).rMultiple
    if (r !== null && isFinite(r)) rs.push(r)
  }
  const buckets: RBucket[] = R_BUCKETS.map(b => ({
    label: b.label,
    tone: b.tone,
    count: rs.filter(b.test).length,
  }))
  const wins = rs.filter(r => r > 0)
  const losses = rs.filter(r => r < 0)
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  return {
    counted: rs.length,
    avgWinR: avg(wins),
    avgLossR: avg(losses),
    bestR: rs.length ? Math.max(...rs) : null,
    worstR: rs.length ? Math.min(...rs) : null,
    buckets,
  }
}
