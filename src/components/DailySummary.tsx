import type { ChecklistState, DayNotes, Trade } from '../types'
import { CHECKLIST_ITEMS } from '../types'
import { calcTrade, fmtMoney, fmtR, summarize } from '../lib/calc'

interface Props {
  date: string
  trades: Trade[]
  checklist: ChecklistState
  dayNotes: DayNotes
  onToggle: (key: keyof ChecklistState, value: boolean) => void
  onDayNotes: (patch: Partial<DayNotes>) => void
  onNewTrade: () => void
  onPrint: () => void
  /** Consecutive fully-completed checklist days (computed over all journal days) */
  streak?: { current: number; best: number }
}

export default function DailySummary({ date, trades, checklist, dayNotes, onToggle, onDayNotes, onNewTrade, onPrint, streak }: Props) {
  const closed = trades.filter(t => t.result !== 'open')
  const s = summarize(closed)
  const done = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length
  const score = Math.round((done / CHECKLIST_ITEMS.length) * 100)

  const bestStreak = streak?.best ?? 0
  const curStreak = streak?.current ?? 0
  const streakLabel =
    curStreak > 0
      ? `🔥 ${curStreak} day${curStreak === 1 ? '' : 's'} clean`
      : bestStreak > 0
        ? `Streak broken — best was ${bestStreak}`
        : 'Complete the full checklist to start a streak'

  // Paper bottom row: Total trades · Win Rate · Total Profit · Best Trade
  const decided = s.wins + s.losses
  const winRate = decided ? s.wins / decided : null
  const best = closed
    .map(t => ({ t, pnl: calcTrade(t).pnl }))
    .filter(x => x.pnl !== null)
    .sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))[0]

  return (
    <section className="card daily">
      <header className="daily-head">
        <div>
          <h2>Trading Journal</h2>
          <p className="sub">{date}</p>
        </div>
        <div className="daily-actions">
          <button type="button" className="btn ghost" onClick={onPrint} disabled={trades.length === 0}>🖨 Print</button>
          <button type="button" className="btn primary" onClick={onNewTrade}>+ Trade</button>
        </div>
      </header>

      <div className="paper-header-row">
        <label className="field inline">
          <span>Risk per trade %</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={dayNotes.riskPerTrade ?? ''}
            onChange={e => onDayNotes({ riskPerTrade: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="1"
          />
        </label>
        <p className="sub">
          {trades.length} trade{trades.length === 1 ? '' : 's'} logged ·{' '}
          <span style={{ color: s.netPnl > 0 ? 'var(--green)' : s.netPnl < 0 ? 'var(--red)' : undefined }}>
            {fmtMoney(s.netPnl)}
          </span>{' '}
          · {fmtR(s.netR)}
        </p>
      </div>

      <div className="mini-stats">
        <div><small>Total trades</small><strong>{trades.length}</strong></div>
        <div><small>Win rate</small><strong>{winRate !== null ? `${Math.round(winRate * 100)}%` : '—'}</strong></div>
        <div><small>Total profit</small><strong style={{ color: s.netPnl > 0 ? 'var(--green)' : s.netPnl < 0 ? 'var(--red)' : undefined }}>{fmtMoney(s.netPnl)}</strong></div>
        <div><small>Best trade</small><strong className="green">{best ? fmtMoney(best.pnl) : '—'}</strong></div>
      </div>
      <div className="mini-stats secondary">
        <div><small>Wins</small><strong className="green">{s.wins}</strong></div>
        <div><small>Losses</small><strong className="red">{s.losses}</strong></div>
        <div><small>BE</small><strong className="amber">{s.breakeven}</strong></div>
        <div><small>Open</small><strong className="blue">{trades.filter(t => t.result === 'open').length}</strong></div>
      </div>

      <div className="checklist-head">
        <span>Checklist</span>
        <span className="streak-chip" title="Consecutive days with the full checklist complete">
          {streakLabel}
        </span>
        <span className="score">{done}/{CHECKLIST_ITEMS.length} · {score}%</span>
      </div>
      <div className="checklist">
        {CHECKLIST_ITEMS.map(item => (
          <label key={item.key} className={checklist[item.key] ? 'checked' : ''}>
            <input
              type="checkbox"
              checked={checklist[item.key]}
              onChange={e => onToggle(item.key, e.target.checked)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      {score === 100 && <p className="all-good">✅ Full discipline day — this is how accounts grow. {bestStreak > 0 && `(best streak: ${bestStreak})`}</p>}

      <label className="field">
        <span>Today's biggest learning</span>
        <textarea
          rows={2}
          value={dayNotes.biggestLearning}
          onChange={e => onDayNotes({ biggestLearning: e.target.value })}
          placeholder="The one thing today taught you…"
        />
      </label>
      <label className="field">
        <span>Plan for tomorrow</span>
        <textarea
          rows={2}
          value={dayNotes.planForTomorrow}
          onChange={e => onDayNotes({ planForTomorrow: e.target.value })}
          placeholder="Pairs, sessions, setups you'll hunt…"
        />
      </label>
      <p className="sub center">
        {!dayNotes.biggestLearning && !dayNotes.planForTomorrow
          ? 'Fill these at the end of the day — future you will thank you.'
          : !dayNotes.planForTomorrow
            ? '✓ Learning captured — still need a plan for tomorrow.'
            : !dayNotes.biggestLearning
              ? '✓ Plan set — what was today\'s biggest learning?'
              : '✓ Reflection complete.'}
      </p>
    </section>
  )
}
