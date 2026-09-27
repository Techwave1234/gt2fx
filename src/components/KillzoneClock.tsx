import { useEffect, useState } from 'react'
import { killzoneStatus, type KillzoneStatus } from '../lib/killzones'

/** Live NY clock + killzone status widget for the main screen. */
export default function KillzoneClock() {
  const [status, setStatus] = useState<KillzoneStatus | null>(() => killzoneStatus())

  useEffect(() => {
    const id = setInterval(() => setStatus(killzoneStatus()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!status) return null

  const { active, nyTime, activeElapsed, activeTotal, next } = status
  const pct = active && activeElapsed !== null && activeTotal ? Math.round((activeElapsed / activeTotal) * 100) : 0
  const hrs = Math.floor(next.minutesUntil / 60)
  const mins = next.minutesUntil % 60
  const untilText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`

  return (
    <section className={`card kz-clock ${active ? 'live' : 'off'}`}>
      <div className="kzc-top">
        <span className="kzc-dot" aria-hidden />
        <span className="kzc-label">{active ? active.label : 'No killzone'}</span>
        <span className="kzc-ny">🇺🇸 {nyTime} NY</span>
      </div>

      {active ? (
        <>
          <div className="kzc-bar">
            <div className="kzc-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="kzc-sub">
            {pct}% elapsed · {activeTotal! - activeElapsed!}m left · {active.note}
          </p>
        </>
      ) : (
        <p className="kzc-sub">
          Next up: <b>{next.kz.label}</b> in {untilText} · {next.kz.start}–{next.kz.end} NY
        </p>
      )}
    </section>
  )
}
