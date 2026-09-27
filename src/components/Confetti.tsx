import { useMemo } from 'react'

const COLORS = ['#2fd882', '#4f8cff', '#ffb648', '#b48bff', '#ff5d6c']

interface Piece {
  left: number
  delay: number
  duration: number
  size: number
  color: string
  drift: number
}

function makePieces(n: number): Piece[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2.2 + Math.random() * 1.4,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    drift: -40 + Math.random() * 80,
  }))
}

/** Fixed, click-through confetti overlay; parent unmounts it when done. */
export default function Confetti({ onDone, duration = 3600 }: { onDone: () => void; duration?: number }) {
  const pieces = useMemo(() => makePieces(60), [])
  setTimeout(onDone, duration)

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
