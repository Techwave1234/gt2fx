import { useMemo, useState } from 'react'
import type { Trade } from '../types'
import { fmtMoney, fmtR } from '../lib/calc'
import { addWeeks, analyzeWeek, rDistribution, startOfWeek, type GroupStat } from '../lib/weekly'
import { calcTrade } from '../lib/calc'

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

  const a = useMemo(() => analyzeWeek(trades, weekStart), [trades, weekStart])
  const rDist = useMemo(() => rDistribution(a.closedTrades), [a.closedTrades])

  // Emotion → R impact: avg R per emotion tag + a "no tags" baseline, worst first
  const emotionImpact = useMemo(() => {
    const rows = a.byEmotion
      .filter(e => e.avgR !== null && e.count >= 1)
      .map(e => ({ key: e.key, count: e.count, avgR: e.avgR as number }))
      .sort((x, y) => x.avgR - y.avgR)
    let rSum = 0, rN = 0, tagless = 0
    for (const t of a.closedTrades) {
      if (t.emotions.length > 0) continue
      tagless++
      const r = calcTrade(t).rMultiple
      if (r !== null && isFinite(r)) { rSum += r; rN++ }
    }
    return { rows, baseAvg: rN ? rSum / rN : null, baseCount: tagless }
  }, [a])

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
        <button
          type="button"
          className="btn mini ghost"
          onClick={() => setWeekStart(w => addWeeks(w, 1))}
          disabled={isThisWeek}
          aria-label="Next week"
        >
          →
        </button>
      </header>

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

      {emotionImpact.rows.length > 0 && (
        <div className="emotion-impact">
          <h3>Emotion → R impact</h3>
          <p className="sub">Average R of trades tagged with each emotion — worst first. Center line = 0R.</p>
          <div className="ei-rows">
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
      )}

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
    </section>
  )
}
