import { useEffect, useMemo, useRef, useState } from 'react'
import { PAIRS, resolvePair, type PairCategory } from '../lib/pairs'

const CATS: ('All' | PairCategory)[] = ['All', 'FX', 'Metals', 'Indices', 'Energies', 'Crypto']

const CAT_COLOR: Record<PairCategory, string> = {
  FX: 'var(--blue)',
  Metals: '#ffd166',
  Indices: '#b48bff',
  Energies: 'var(--red)',
  Crypto: 'var(--green)',
}

interface Props {
  value: string
  onChange: (v: string) => void
}

/** Searchable pair input with category filter tabs — replaces the plain datalist. */
export default function PairPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<'All' | PairCategory>('All')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    return PAIRS.filter(p => {
      if (cat !== 'All' && p.category !== cat) return false
      if (!q) return true
      return p.symbol.includes(q) || p.category.toUpperCase().includes(q)
    })
  }, [query, cat])

  return (
    <div className="pair-picker" ref={wrapRef}>
      <input
        type="text"
        value={value}
        placeholder="Search or pick…"
        required
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value.toUpperCase())
          setOpen(true)
        }}
      />
      {open && (
        <div className="pp-pop">
          <div className="pp-tabs">
            {CATS.map(c => (
              <button key={c} type="button" className={cat === c ? 'pp-tab active' : 'pp-tab'} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="pp-list">
            {filtered.length === 0 && <p className="pp-empty">No pairs match “{query}”</p>}
            {filtered.map(p => (
              <button
                key={p.symbol}
                type="button"
                className={resolvePair(value) === p.symbol ? 'pp-item selected' : 'pp-item'}
                onClick={() => {
                  onChange(p.symbol)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <span className="pp-sym">{p.symbol}</span>
                <span className="pp-cat" style={{ color: CAT_COLOR[p.category] }}>{p.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
