import { useMemo, useState } from 'react'
import type { Trade } from '../types'
import { calcTrade, fmtMoney, fmtR } from '../lib/calc'
import { addWeeks, analyzeMonthView, analyzeWeek, emotionImpactOf, rDistribution, startOfWeek, type GroupStat } from '../lib/weekly'
import { downloadCsv, weeklySummaryCsv } from '../lib/csv'

interface Props {
  trades: Trade[]
}

const EMOTION_TONE: Record<string, 'good' | 'warn' | 'bad'> = {
  calm: 'good',
  confident: 'good',
  bored: 'warn',
  impatient: 'warn',
  fomo: 'bad',
  greedy: 'bad',
  revengeful: 'bad',
  fearful: 'warn',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function GroupTable(props: {
  title: string
  rows: GroupStat[]
  tone?: (key: string) => string | undefined
  emptyText: string
}) {
  const { title, rows, tone, emptyText } = props
  return (
    <div className="group-table">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="empty small-empty">{emptyText}</p>
      ) : (
        <>
          <div className="gt-head">
            <span>Name</span><span>N</span><span>Win%</span><span>Net</span><span>Avg R</span>
          </div>
          {rows.map(g => (
            <div key={g.key} className="gt-row">
              <span className="gt-name" style={tone ? { color: tone(g.key) } : undefined}>{g.key}</span>
              <span>{g.count}</span>
              <span>{g.winRate !== null ? `${Math.round(g.winRate * 100)}%` : '—'}</span>
              <span style={{ color: g.netPnl > 0 ? 'var(--green)' : g.netPnl < 0 ? 'var(--red)' : undefined }}>
                {fmtMoney(g.netPnl)}
              </span>
              <span style={{ color: (g.avgR ?? 0) > 0 ? 'var(--green)' : (g.avgR ?? 0) < 0 ? 'var(--red)' : undefined }}>
                {g.avgR !== null ? fmtR(g.avgR) : '—'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function WeeklyReview({ trades }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [csvDone, setCsvDone] = useState(false)
  const [view, setView] = useState<'week' | 'month'>('week')
  const months = useMemo(() => analyzeMonths(trades), [trades])

  const a = useMemo(() => analyzeWeek(trades, weekStart), [trades, weekStart])
  const rDist = useMemo(() => rDistribution(a.closedTrades), [a.closedTrades])

  // Emotion → R impact: this week or all-time, avg R per tag + untagged baseline
  const [eScope, setEScope] = useState<'week' | 'all'>('week')
  const emotionImpact = useMemo(
    () => emotionImpactOf(eScope === 'all' ? trades.filter(t => t.result !== 'open') : a.closedTrades),
    [eScope, a.closedTrades, trades],
  )

  const now = startOfWeek(new Date())
  const isThisWeek = weekStart.getTime() === now.getTime()

  const notes = useMemo(() => {
    const out: string[] = []
    const worstE = emotionImpact.rows[0]
    if (worstE && worstE.count >= 2 && worstE.avgR < 0 && emotionImpact.baseAvg !== null && emotionImpact.baseAvg > worstE.avgR)
      out.push(`Trades tagged "${worstE.key}" average ${fmtR(worstE.avgR)} vs ${fmtR(emotionImpact.baseAvg)} without tags — that emotion is your most expensive leak.`)
    const bad = a.byEmotion.filter(e => ['fomo', 'greedy', 'revengeful', 'impatient', 'fearful', 'bored'].includes(e.key))
    const worstEmotion = bad.sort((x, y) => y.count - x.count)[0]
    if (worstEmotion) out.push(`"${worstEmotion.key}" showed up in ${worstEmotion.count} trade(s) — tag it before entry next week and pause when it appears.`)
    const kzLosing = a.byKillzone.filter(k => k.key !== 'No killzone' && k.count >= 2 && k.netPnl < 0)
    if (kzLosing.length) out.push(`Killzone "${kzLosing[0].key}" is net negative (${fmtMoney(kzLosing[0].netPnl)} over ${kzLosing[0].count} trades) — consider trading only your best sessions.`)
    const kzNoKz = a.byKillzone.find(k => k.key === 'No killzone')
    if (kzNoKz && kzNoKz.count >= 3 && kzNoKz.netPnl < 0)
      out.push(`${kzNoKz.count} trades outside any killzone lost ${fmtMoney(kzNoKz.netPnl)} — off-hours trading looks like a leak.`)
    const losers = a.bySetup.filter(s => s.netPnl < 0 && s.count >= 2)
    if (losers.length) out.push(`Setup "${losers[0].key}" lost ${fmtMoney(losers[0].netPnl)} over ${losers[0].count} trades — consider tightening its criteria or pausing it.`)
    const winners = a.bySetup.filter(s => s.netPnl > 0 && s.count >= 2)
    if (winners.length) out.push(`Your best setup was "${winners[0].key}" (${fmtMoney(winners[0].netPnl)}, ${winners[0].winRate !== null ? `${Math.round(winners[0].winRate * 100)}%` : '—'} win rate) — size it consistently.`)
    if (a.winRate !== null && a.netR < 0 && a.winRate > 0.5)
      out.push('Win rate above 50% but negative R: winners are too small or losers too big. Let winners run to plan.')
    if (a.redDays >= 3 && a.tradingDays >= 4)
      out.push(`${a.redDays} red days out of ${a.tradingDays} — consider a max daily loss rule and stop after 2 losses.`)
    if (a.closedCount >= 15)
      out.push(`${a.closedCount} closed trades this week — watch for overtrading; quality over quantity.`)
    if (!out.length && a.total === 0) out.push('No trades this week. Rest is part of the process — or log trades to unlock insights.')
    if (!out.length) out.push('Clean week — no glaring leaks detected. Keep the process steady.')
    return out
  }, [a, emotionImpact])

  // All-time best and worst closed trades by realized P/L
  const extremes = useMemo(() => {
    let best: { t: Trade; pnl: number; r: number | null } | null = null
    let worst: { t: Trade; pnl: number; r: number | null } | null = null
    for (const t of trades) {
      if (t.result === 'open') continue
      const c = calcTrade(t)
      if (c.pnl === null) continue
      if (!best || c.pnl > best.pnl) best = { t, pnl: c.pnl, r: c.rMultiple }
      if (!worst || c.pnl < worst.pnl) worst = { t, pnl: c.pnl, r: c.rMultiple }
    }
    return { best, worst }
  }, [trades])

  function exportWeeklyCsv() {
    downloadCsv(weeklySummaryCsv(trades), `gt2fx-weekly-summary-${todayIso()}.csv`)
    setCsvDone(true)
    setTimeout(() => setCsvDone(false), 2500)
  }

  return (
    <section className="card weekly">
      <header className="week-nav">
        <button type="button" className="btn mini ghost" onClick={() => setWeekStart(w => addWeeks(w, -1))} aria-label="Previous week">←</button>
        <div className="week-title">
          <h2>{a.label}</h2>
          {!isThisWeek && (
            <button type="button" className="link-btn" onClick={() => setWeekStart(now)}>jump to this week</button>
          )}
        </div>
        <div className="week-actions">
          <button type="button" className="btn mini ghost" onClick={exportWeeklyCsv} disabled={trades.length === 0} title="One row per week: stats, best/worst setup and pair">
            {csvDone ? '✓' : '⬇ CSV'}
          </button>
          <button type="button" className="btn mini ghost" onClick={() => setWeekStart(w => addWeeks(w, 1))} disabled={isThisWeek} aria-label="Next week">→</button>
        </div>
      </header>

      {(extremes.best || extremes.worst) && (
        <div className="extremes">
          {extremes.best && (
            <div className="extreme best">
              <small>🏆 All-time best trade</small>
              <b>{fmtMoney(extremes.best.pnl)}</b>
              <span>
                {extremes.best.t.pair} {extremes.best.t.direction === 'long' ? '▲' : '▼'} · {extremes.best.t.date}
                {extremes.best.r !== null && <> · {fmtR(extremes.best.r)}</>}
                {extremes.best.t.setup && <> · {extremes.best.t.setup}</>}
              </span>
            </div>
          )}
          {extremes.worst && (
            <div className="extreme worst">
              <small>💀 All-time worst trade</small>
              <b>{fmtMoney(extremes.worst.pnl)}</b>
              <span>
                {extremes.worst.t.pair} {extremes.worst.t.direction === 'long' ? '▲' : '▼'} · {extremes.worst.t.date}
                {extremes.worst.r !== null && <> · {fmtR(extremes.worst.r)}</>}
                {extremes.worst.t.setup && <> · {extremes.worst.t.setup}</>}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="view-toggle">
        <div className="seg small">
          <button type="button" className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>By week</button>
          <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>By month</button>
        </div>
      </div>

      {view === 'month' ? (
        <div className="month-grid">
          {months.length === 0 && <p className="empty small-empty">No months with trades yet.</p>}
          {months.map(m => {
            const maxAbs = Math.max(1, ...months.map(x => Math.abs(x.netPnl)))
            const w = Math.min(100, (Math.abs(m.netPnl) / maxAbs) * 100)
            return (
              <div key={m.key} className="month-card">
                <div className="mc-head">
                  <b>{m.label}</b>
                  <strong style={{ color: m.netPnl > 0 ? 'var(--green)' : m.netPnl < 0 ? 'var(--red)' : undefined }}>
                    {fmtMoney(m.netPnl)}
                  </strong>
                </div>
                <div className="mc-bar">
                  <div className={m.netPnl >= 0 ? 'mc-fill pos' : 'mc-fill neg'} style={{ width: `${w}%` }} />
                </div>
                <p className="mc-sub">
                  {m.total} trade{m.total === 1 ? '' : 's'} · {m.winRate !== null ? `${Math.round(m.winRate * 100)}%` : '—'} WR · {fmtR(m.netR)} · <span className="green">{m.greenDays}▲</span> <span className="red">{m.redDays}▼</span>
                </p>
              </div>
            )
          })}
        </div>
      ) : (
      <div className="calc-strip big">
        <div><small>Trades</small><strong>{a.total}</strong></div>
        <div><small>Win rate</small><strong>{a.winRate !== null ? `${Math.round(a.winRate * 100)}%` : '—'}</strong></div>
        <div><small>Net P/L</small><strong style={{ color: a.netPnl > 0 ? 'var(--green)' : a.netPnl < 0 ? 'var(--red)' : undefined }}>{fmtMoney(a.netPnl)}</strong></div>
        <div><small>Net R</small><strong>{fmtR(a.netR)}</strong></div>
      </div>

      <div className="week-days">
        {a.byDay.map(d => (
          <div key={d.date} className={`day-cell ${d.count ? 'traded' : ''}`}>
            <small>{d.label}</small>
            <strong style={{ color: d.pnl === null ? undefined : d.pnl > 0 ? 'var(--green)' : d.pnl < 0 ? 'var(--red)' : undefined }}>
              {d.count ? (d.pnl !== null ? fmtMoney(d.pnl) : '—') : '·'}
            </strong>
            <small className="day-count">{d.count ? `${d.count} trade${d.count === 1 ? '' : 's'}` : ''}</small>
          </div>
        ))}
      </div>
      <p className="sub center">{a.tradingDays} trading day(s) · {a.greenDays} green · {a.redDays} red</p>

      <GroupTable
        title="By setup"
        rows={a.bySetup}
        emptyText="Tag setups on your trades to see which ones actually pay."
      />

      <GroupTable
        title="By emotion"
        rows={a.byEmotion}
        tone={k => (EMOTION_TONE[k] === 'good' ? 'var(--green)' : EMOTION_TONE[k] === 'bad' ? 'var(--red)' : 'var(--amber)')}
        emptyText="Tag emotions on your trades to spot your psychological patterns."
      />

      <GroupTable
        title="By killzone"
        rows={a.byKillzone}
        tone={k => (k === 'No killzone' ? 'var(--muted)' : undefined)}
        emptyText="Pick a killzone when logging trades to see which session actually pays you."
      />

      <div className="emotion-impact">
          <div className="ei-head">
            <h3>Emotion → R impact</h3>
            <div className="seg small">
              <button type="button" className={eScope === 'week' ? 'active' : ''} onClick={() => setEScope('week')}>This week</button>
              <button type="button" className={eScope === 'all' ? 'active' : ''} onClick={() => setEScope('all')}>All time</button>
            </div>
          </div>
          <p className="sub">
            {eScope === 'all' ? 'Every tagged trade across all weeks' : "This week's tagged trades"} — worst first. Center line = 0R.
          </p>
          <div className="ei-rows">
            {emotionImpact.rows.length === 0 && (
              <p className="empty small-empty">
                No tagged trades {eScope === 'all' ? 'ever' : 'this week'} — tag emotions when closing losses and your patterns will chart here.
              </p>
            )}
            {emotionImpact.rows.map(e => {
              const maxAbs = Math.max(
                0.5,
                ...emotionImpact.rows.map(r => Math.abs(r.avgR)),
                Math.abs(emotionImpact.baseAvg ?? 0),
              )
              const w = Math.min(100, (Math.abs(e.avgR) / maxAbs) * 100)
              return (
                <div key={e.key} className="ei-row">
                  <span className="ei-name" style={{ color: EMOTION_TONE[e.key] === 'good' ? 'var(--green)' : EMOTION_TONE[e.key] === 'bad' ? 'var(--red)' : 'var(--amber)' }}>
                    {e.key}
                  </span>
                  <div className="ei-track">
                    <div className="ei-half left">
                      {e.avgR < 0 && <div className="ei-bar neg" style={{ width: `${w}%` }} title={`${e.count} trade(s), avg ${fmtR(e.avgR)}`} />}
                    </div>
                    <div className="ei-half right">
                      {e.avgR >= 0 && <div className="ei-bar pos" style={{ width: `${w}%` }} title={`${e.count} trade(s), avg ${fmtR(e.avgR)}`} />}
                    </div>
                  </div>
                  <span className="ei-val" style={{ color: e.avgR >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtR(e.avgR)}</span>
                  <span className="ei-n">{e.count}</span>
                </div>
              )
            })}
            {emotionImpact.baseAvg !== null && emotionImpact.baseCount > 0 && (() => {
              const maxAbs = Math.max(0.5, ...emotionImpact.rows.map(r => Math.abs(r.avgR)), Math.abs(emotionImpact.baseAvg))
              const w = Math.min(100, (Math.abs(emotionImpact.baseAvg) / maxAbs) * 100)
              return (
                <div className="ei-row baseline">
                  <span className="ei-name">no tags</span>
                  <div className="ei-track">
                    <div className="ei-half left">
                      {emotionImpact.baseAvg < 0 && <div className="ei-bar muted" style={{ width: `${w}%` }} />}
                    </div>
                    <div className="ei-half right">
                      {emotionImpact.baseAvg >= 0 && <div className="ei-bar muted" style={{ width: `${w}%` }} />}
                    </div>
                  </div>
                  <span className="ei-val muted-val">{fmtR(emotionImpact.baseAvg)}</span>
                  <span className="ei-n">{emotionImpact.baseCount}</span>
                </div>
              )
            })()}
          </div>
        </div>

      <GroupTable
        title="By pair"
        rows={a.byPair}
        emptyText="Log a few trades and your best and worst instruments will show up here."
      />

      {rDist.counted > 0 && (
        <div className="r-histogram">
          <h3>R-multiple distribution</h3>
          <div className="calc-strip">
            <div><small>Avg win</small><strong className="green">{rDist.avgWinR !== null ? fmtR(rDist.avgWinR) : '—'}</strong></div>
            <div><small>Avg loss</small><strong className="red">{rDist.avgLossR !== null ? fmtR(rDist.avgLossR) : '—'}</strong></div>
            <div><small>Best</small><strong className="green">{fmtR(rDist.bestR)}</strong></div>
            <div><small>Worst</small><strong className="red">{fmtR(rDist.worstR)}</strong></div>
          </div>
          <div className="r-bars">
            {rDist.buckets.map(b => {
              const max = Math.max(...rDist.buckets.map(x => x.count), 1)
              return (
                <div key={b.label} className="r-col">
                  <small className="r-count">{b.count || ''}</small>
                  <div className="r-bar-zone">
                    <div
                      className={`r-bar ${b.tone}`}
                      style={{ height: `${b.count ? Math.max(8, (b.count / max) * 100) : 0}%` }}
                      title={`${b.count} trade(s) between ${b.label}`}
                    />
                  </div>
                  <small className="r-label">{b.label}</small>
                </div>
              )
            })}
          </div>
          <p className="sub center">How your {rDist.counted} closed trade(s) landed relative to risk (1R = planned risk)</p>
        </div>
      )}

      <div className="coach-notes">
        <h3>Coach notes</h3>
        <ul>
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
      )}
    </section>
  )
}
