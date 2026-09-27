import type { Trade } from '../types'
import { calcTrade, fmtNum } from './calc'
import { todayISO } from './backup'

/** Quote every field; double up embedded quotes. Excel/Sheets-safe. */
function esc(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

const HEADERS = [
  'Date', 'Time', 'Session', 'Killzone', 'Pair', 'Direction', 'Strategy',
  'HTF Bias', 'MTF Bias', 'LTF Bias', 'POI', 'Entry Model',
  'Entry Price', 'Stop Loss', 'Take Profit', 'Exit Price',
  'Lot', 'Risk %', 'Balance', 'Risk $', 'Reward $', 'R:R',
  'Result', 'P/L $', 'R Multiple',
  'Confidence', 'Emotions', 'Entry Reason', 'Exit Reason', 'Notes',
  'Lesson Learned', 'Followed Plan', 'Screenshot',
]

const n = (v: number | null): string => (v === null ? '' : String(v))

export function tradesToCsv(trades: Trade[]): string {
  const rows: string[][] = [HEADERS]
  for (const t of trades) {
    const c = calcTrade(t)
    rows.push([
      t.date,
      t.time,
      t.session,
      t.killzone,
      t.pair,
      t.direction === 'long' ? 'Buy' : 'Sell',
      t.setup,
      t.biasHTF,
      t.biasMTF,
      t.biasLTF,
      t.poi,
      t.entryModel,
      n(t.entry),
      n(t.stopLoss),
      n(t.takeProfit),
      n(t.exit),
      n(t.lots),
      n(t.riskPercent),
      n(t.balance),
      n(c.riskAmount === null ? null : Number(c.riskAmount.toFixed(2))),
      n(c.plannedReward === null ? null : Number(c.plannedReward.toFixed(2))),
      c.rr === null ? '' : fmtNum(c.rr, 2),
      t.result,
      c.pnl === null ? '' : c.pnl.toFixed(2),
      c.rMultiple === null ? '' : c.rMultiple.toFixed(2),
      String(t.confidence),
      t.emotions.join('; '),
      t.entryReason,
      t.exitReason,
      t.notes,
      t.lessons,
      t.followedPlan ? 'Yes' : 'No',
      t.screenshotUrl,
    ].map(esc))
  }
  // \r\n line endings + UTF-8 BOM so Excel opens it cleanly
  const body = rows.map(r => r.join(',')).join('\r\n')
  return '\uFEFF' + body + '\r\n'
}

export function downloadCsv(content: string, fileName?: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName ?? `gt2fx-journal-trades-${todayISO()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
