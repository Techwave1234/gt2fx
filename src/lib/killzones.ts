export interface Killzone {
  id: string
  label: string
  /** Start "HH:MM" in New York time */
  start: string
  /** End "HH:MM" in New York time */
  end: string
  /** Session value this maps to in the journal */
  session: 'Asia' | 'London' | 'New York' | 'Overlap'
  /** What the killzone is known for */
  note: string
}

/** ICT killzones, anchored to New York time (DST handled via Intl at runtime) */
export const KILLZONES: Killzone[] = [
  { id: 'asia', label: 'Asia KZ', start: '20:00', end: '00:00', session: 'Asia', note: 'Range builds — mark highs/lows for the London sweep' },
  { id: 'london', label: 'London KZ', start: '02:00', end: '05:00', session: 'London', note: 'Judas swing / Asian range sweep — classic manipulation window' },
  { id: 'ny', label: 'NY KZ', start: '07:00', end: '10:00', session: 'New York', note: 'London close + NY open — displacement & retracements' },
  { id: 'lclose', label: 'London Close', start: '10:00', end: '12:00', session: 'Overlap', note: 'Reversal window — last push of the day' },
]

export function killzoneById(id: string): Killzone | undefined {
  return KILLZONES.find(k => k.id === id)
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Wall-clock minutes since midnight in New York for the given instant (DST-correct) */
function nyMinutes(d: Date): number | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(d)
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? 'NaN')
    const m = Number(parts.find(p => p.type === 'minute')?.value ?? 'NaN')
    if (isNaN(h) || isNaN(m)) return null
    return (h % 24) * 60 + m
  } catch {
    return null
  }
}

export interface KillzoneDetection {
  kz: Killzone
  /** HH:MM in New York for this instant */
  nyTime: string
  /** Your local HH:MM used for detection */
  localTime: string
}

export interface KillzoneStatus {
  /** Killzone active right now, or null when off-hours */
  active: Killzone | null
  /** HH:MM:SS in New York */
  nyTime: string
  /** Minutes elapsed / remaining in the active window */
  activeElapsed: number | null
  activeTotal: number | null
  /** Next killzone to start and how many minutes until it opens */
  next: { kz: Killzone; minutesUntil: number }
}

/** Live status for the widget: active killzone, progress and next window. */
export function killzoneStatus(d = new Date()): KillzoneStatus | null {
  const ny = nyMinutes(d)
  if (ny === null) return null
  const hh = String(Math.floor(ny / 60)).padStart(2, '0')
  const mm = String(ny % 60).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')

  let active: Killzone | null = null
  let activeElapsed: number | null = null
  let activeTotal: number | null = null
  let next = { kz: KILLZONES[0], minutesUntil: Infinity }

  for (const kz of KILLZONES) {
    const s = toMin(kz.start)
    const e = toMin(kz.end)
    const total = (e - s + 1440) % 1440
    const inZone = s <= e ? ny >= s && ny < e : ny >= s || ny < e
    if (inZone) {
      active = kz
      activeTotal = total
      activeElapsed = (ny - s + 1440) % 1440
    }
    const until = (s - ny + 1440) % 1440
    if (until > 0 && until < next.minutesUntil) next = { kz, minutesUntil: until }
  }
  return { active, nyTime: `${hh}:${mm}:${ss}`, activeElapsed, activeTotal, next }
}

/**
 * Detect which killzone a local date+time falls in.
 * `date` = YYYY-MM-DD, `time` = HH:MM (local). Falls back to `new Date()` when time is blank.
 */
export function detectKillzone(date: string, time: string): KillzoneDetection | null {
  const base = `${date}T${/^\d{2}:\d{2}$/.test(time) ? time : '00:00'}:00`
  const instant = new Date(base)
  if (isNaN(instant.getTime())) return null
  if (!/^\d{2}:\d{2}$/.test(time)) instant.setHours(...new Date().toTimeString().slice(0, 5).split(':').map(Number))

  const ny = nyMinutes(instant)
  if (ny === null) return null

  for (const kz of KILLZONES) {
    const s = toMin(kz.start)
    const e = toMin(kz.end)
    const inZone = s <= e ? ny >= s && ny < e : ny >= s || ny < e // handles midnight wrap
    if (inZone) {
      return {
        kz,
        nyTime: `${String(Math.floor(ny / 60)).padStart(2, '0')}:${String(ny % 60).padStart(2, '0')}`,
        localTime: `${String(Math.floor((instant.getHours() * 60 + instant.getMinutes()) / 60)).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`,
      }
    }
  }
  return null
}
