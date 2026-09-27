import { useMemo } from 'react'
import type { Trade } from '../types'
import { calcTrade, fmtMoney, fmtR } from '../lib/calc'

interface Props {
  trades: Trade[]
}

export default function StatsBar({ trades }: Props) {
  const stats = useMemo(() => {
    const closed = trades.filter(t => t.result !== 'open')
    let wins = 0, losses = 0, be = 0, netPnl = 0, netR = 0
    let bestStreak = 0, worstStreak = 0, cur = 0
    const pairs = new Map<string, { n: number; pnl: number }>()
    const byDay = new Map<string, number>()

    for (const t of closed) {
      const c = calcTrade(t)
      if (t.result === 'win') { wins++; cur = cur >= 0 ? cur + 1 : 1 }
      else if (t.result === 'loss') { losses++; cur = cur <= 0 ? cur - 1 : -1 }
      else be++
      bestStreak = Math.max(bestStreak, cur)
      worstStreak = Math.min(worstStreak, cur)
      if (c.pnl !== null) {
        netPnl += c.pnl
        byDay.set(t.date, (byDay.get(t.date) ?? 0) + c.pnl)
      }
      if (c.rMultiple !== null) netR += c.rMultiple
      const e = pairs.get(t.pair) ?? { n: 0, pnl: 0 }
      e.n++
      if (c.pnl !== null) e.pnl += c.pnl
      pairs.set(t.pair, e)
    }

    const decided = wins + losses
    const winRate = decided ? wins / decided : null
    const expectancy = decided ? netR / decided : null
    const days = [...byDay.values()]
    const greenDays = days.filter(v => v > 0).length
    const redDays = days.filter(v => v < 0).length

    const spark = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
    const maxAbs = Math.max(1, ...spark.map(([, v]) => Math.abs(v)))

    return {
      wins, losses, be, netPnl, netR, winRate, expectancy,
      bestStreak, worstStreak, greenDays, redDays,
      pairs: [...pairs.entries()].sort((a, b) => b[1].pnl - a[1].pnl),
      spark, maxAbs, total: closed.length,
    }
  }, [trades])

  if (!stats.total) return null

  return (
    <section className="card stats">
      <h2>Performance</h2>
      <div className="calc-strip big">
        <div><small>Win rate</small><strong>{stats.winRate !== null ? `${Math.round(stats.winRate * 100)}%` : '—'}</strong></div>
        <div><small>Net P/L</small><strong style={{ color: stats.netPnl > 0 ? 'var(--green)' : stats.netPnl < 0 ? 'var(--red)' : undefined }}>{fmtMoney(stats.netPnl)}</strong></div>
        <div><small>Net R</small><strong>{fmtR(stats.netR)}</strong></div>
        <div><small>Expectancy</small><strong>{stats.expectancy !== null ? fmtR(stats.expectancy) : '—'}</strong></div>
        <div><small>Best streak</small><strong className="green">{stats.bestStreak}</strong></div>
        <div><small>Worst streak</small><strong className="red">{stats.worstStreak}</strong></div>
        <div><small>Green days</small><strong className="green">{stats.greenDays}</strong></div>
        <div><small>Red days</small><strong className="red">{stats.redDays}</strong></div>
      </div>

      {stats.spark.length > 1 && (
        <div className="spark" aria-hidden>
          {stats.spark.map(([day, v]) => (
            <div
              key={day}
              className={v >= 0 ? 'bar pos' : 'bar neg'}
              style={{ height: `${Math.max(6, (Math.abs(v) / stats.maxAbs) * 100)}%` }}
              title={`${day}: ${fmtMoney(v)}`}
            />
          ))}
        </div>
      )}
      <p className="sub spark-label">Daily P/L — last 14 sessions</p>

      {stats.pairs.length > 0 && (
        <div className="pair-rows">
          {stats.pairs.slice(0, 5).map(([pair, e]) => (
            <div key={pair} className="pair-row">
              <span className="pair">{pair}</span>
              <span className="sub">{e.n} trades</span>
              <span className="spacer" />
              <strong style={{ color: e.pnl > 0 ? 'var(--green)' : e.pnl < 0 ? 'var(--red)' : undefined }}>{fmtMoney(e.pnl)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
