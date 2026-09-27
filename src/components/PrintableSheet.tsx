import type { ChecklistState, DayNotes, Trade } from '../types'
import { CHECKLIST_ITEMS } from '../types'
import { calcTrade, fmtMoney, summarize } from '../lib/calc'

interface Props {
  date: string
  trades: Trade[]
  checklist: ChecklistState
  dayNotes: DayNotes
}

const dash = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v))

export default function PrintableSheet({ date, trades, checklist, dayNotes }: Props) {
  const closed = trades.filter(t => t.result !== 'open')
  const s = summarize(closed)
  const decided = s.wins + s.losses
  const winRate = decided ? `${Math.round((s.wins / decided) * 100)}%` : '—'
  const best = closed
    .map(t => ({ t, pnl: calcTrade(t).pnl }))
    .filter(x => x.pnl !== null)
    .sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))[0]

  return (
    <div className="print-sheet">
      <div className="ps-head">
        <span className="ps-brand">TRADING JOURNAL</span>
        <span className="ps-date">{date}</span>
      </div>
      <p className="ps-risk">Risk Per Trade : {dayNotes.riskPerTrade !== null ? `${dayNotes.riskPerTrade} %` : '____ %'}</p>

      {trades.length === 0 && <p className="ps-none">No trades logged for this day.</p>}

      {trades.map((t, i) => {
        const c = calcTrade(t)
        return (
          <section className="ps-trade" key={t.id}>
            <div className="ps-t-head">
              <span>TRADE {i + 1}</span>
              <span>{t.pair}</span>
              <span>{t.direction === 'long' ? 'BUY ▲' : 'SELL ▼'}</span>
              <span>{t.time} · {t.session}</span>
              <span className="ps-right">{t.result.toUpperCase()}{c.pnl !== null ? ` · ${fmtMoney(c.pnl)}` : ''}</span>
            </div>
            <div className="ps-grid">
              <span>Entry Price</span><b>{dash(t.entry)}</b>
              <span>Stop Loss</span><b>{dash(t.stopLoss)}</b>
              <span>Take Profit</span><b>{dash(t.takeProfit)}</b>
              <span>Exit Price</span><b>{dash(t.exit)}</b>
              <span>Lot</span><b>{dash(t.lots)}</b>
              <span>Risk</span><b>{c.riskAmount !== null ? fmtMoney(c.riskAmount) : '—'}</b>
              <span>Reward</span><b>{c.plannedReward !== null ? fmtMoney(c.plannedReward) : '—'}</b>
              <span>R:R Ratio</span><b>{c.rr !== null ? `1 : ${c.rr.toFixed(2)}` : '—'}</b>
            </div>
            <div className="ps-lines">
              <p><span>Strategy:</span> {dash(t.setup)}</p>
              <p><span>Entry Reason:</span> {dash(t.entryReason)}</p>
              <p><span>Exit Reason:</span> {dash(t.exitReason)}</p>
              <p><span>Lesson Learned:</span> {dash(t.lessons)}</p>
              <p><span>Emotion:</span> {t.emotions.length ? t.emotions.join(', ') : '—'}</p>
              <p><span>Followed plan:</span> {t.followedPlan ? 'YES' : 'NO'}</p>
            </div>
          </section>
        )
      })}

      <div className="ps-totals">
        <div><span>Total trades</span><b>{trades.length}</b></div>
        <div><span>Win Rate</span><b>{winRate}</b></div>
        <div><span>Total Profit</span><b>{fmtMoney(s.netPnl)}</b></div>
        <div><span>Best Trade</span><b>{best ? fmtMoney(best.pnl) : '—'}</b></div>
      </div>

      <div className="ps-checklist">
        {CHECKLIST_ITEMS.map(item => (
          <span key={item.key}>{checklist[item.key] ? '☑' : '☐'} {item.label}</span>
        ))}
      </div>

      <p className="ps-note"><span>Today's Biggest Learning:</span> {dash(dayNotes.biggestLearning)}</p>
      <p className="ps-note"><span>Plan for Tomorrow:</span> {dash(dayNotes.planForTomorrow)}</p>
    </div>
  )
}
