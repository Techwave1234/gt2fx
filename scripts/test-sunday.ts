/* eslint-disable @typescript-eslint/no-explicit-any */
// Sunday auto-backup test harness.
// Freezes Date, stubs localStorage/document/Blob/URL, runs checkSundayBackup/runSundayBackup
// across scenarios, and verifies the downloaded payload — all without a browser.
// Run with: npx tsx scripts/test-sunday.ts

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.error(`  ✗ ${name}`, extra ?? '')
  }
}

/* ---------- fixed local timestamps (computed with the REAL Date) ---------- */
const RealDate = Date
const SUNDAY_MS = new RealDate(2026, 8, 27, 10, 0, 0).getTime() // Sun 27 Sep 2026, 10:00 local
const SATURDAY_MS = SUNDAY_MS - 1 * 86400_000
const WEDNESDAY_MS = SUNDAY_MS - 4 * 86400_000
const PREV_WEEK_MS = SUNDAY_MS - 7 * 86400_000 - 1 // just before this week's Monday

/* ---------- fake clock ---------- */
class FakeDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(SUNDAY_MS)
    else super(...(args as []))
  }
  static now(): number {
    return SUNDAY_MS
  }
}

/* ---------- browser stubs ---------- */
const store = new Map<string, string>()
const localStorageStub = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
}

let lastAnchor: { href: string; download: string } | null = null
let lastBlob: Blob | null = null
const documentStub = {
  body: {
    appendChild: () => {},
  },
  createElement: (_tag: string) => {
    const anchor = {
      href: '',
      download: '',
      click: () => {
        lastAnchor = { href: anchor.href, download: anchor.download }
      },
      remove: () => {},
    }
    return anchor
  },
}

;(globalThis as any).Date = FakeDate
;(globalThis as any).localStorage = localStorageStub
;(globalThis as any).document = documentStub
// Patch only the statics — tsx's loader needs the real URL constructor intact
;(URL as any).createObjectURL = (b: Blob) => {
  lastBlob = b
  return 'blob:fake'
}
;(URL as any).revokeObjectURL = () => {}

/* ---------- import modules AFTER globals are patched ---------- */
const { checkSundayBackup, runSundayBackup } = await import('../src/lib/sundayBackup.ts')

function makeTrade(createdAt: number, id: string) {
  return {
    id, date: '2026-09-23', time: '10:00', session: 'London', killzone: 'london',
    pair: 'XAUUSD', direction: 'long' as const, setup: '',
    biasHTF: '' as const, biasMTF: '' as const, biasLTF: '' as const,
    poi: '', entryModel: '',
    entry: 2650, stopLoss: 2645, takeProfit: 2665, exit: null,
    lots: 0.3, riskPercent: 1, balance: 5000,
    result: 'open' as const, confidence: 3, emotions: [],
    notes: '', lessons: '', entryReason: '', exitReason: '',
    followedPlan: false, screenshotUrl: '', createdAt,
  }
}

const BASE_PARTS = {
  checklists: {},
  dayNotes: { '2026-09-23': { riskPerTrade: 1, biggestLearning: 'stay out of range', planForTomorrow: 'NY killzone only' } },
  aiConfig: { provider: 'offline', apiKey: '', model: '' },
  aiHistory: [],
}

function reset() {
  store.clear()
  lastAnchor = null
  lastBlob = null
}

/* ---------- scenario 1: Sunday, new trades, never run → DUE ---------- */
console.log('\n[1] Sunday + trades this week + never run')
reset()
const sundayTrades = [makeTrade(WEDNESDAY_MS, 't1')]
let c = checkSundayBackup(sundayTrades)
check('isSunday', c.isSunday === true, c)
check('weekTrades = 1', c.weekTrades === 1, c)
check('due', c.due === true, c)

/* ---------- scenario 2: run it → download + marking ---------- */
console.log('\n[2] runSundayBackup downloads and marks')
const result = runSundayBackup({ trades: sundayTrades, ...BASE_PARTS, weekTrades: c.weekTrades })
check('anchor clicked', lastAnchor !== null)
check(
  'filename has auto-sunday + today',
  lastAnchor === null || (/^gt2fx-journal-backup-2026-09-27-auto-sunday\.json$/.test(lastAnchor.download)),
  lastAnchor,
)
check('lastrun recorded for today', store.get('gt2fx.autobackup.lastrun') === '2026-09-27', store.get('gt2fx.autobackup.lastrun'))
check('export marked for reminder', typeof store.get('gt2fx.backup.lastexport') === 'string')
if (lastBlob) {
  const payload = JSON.parse(await lastBlob.text())
  check('payload has 1 trade', Array.isArray(payload.trades) && payload.trades.length === 1, payload.trades?.length)
  check('payload includes dayNotes', payload.dayNotes?.['2026-09-23']?.planForTomorrow === 'NY killzone only', payload.dayNotes)
  check('payload version 1', payload.version === 1)
  check('payload exportedAt is fake Sunday', String(payload.exportedAt).startsWith('2026-09-27'), payload.exportedAt)
} else {
  check('blob captured', false)
}

/* ---------- scenario 3: re-check same Sunday → NOT due ---------- */
console.log('\n[3] same Sunday after running')
c = checkSundayBackup(sundayTrades)
check('alreadyRanToday', c.alreadyRanToday === true, c)
check('not due anymore', c.due === false, c)

/* ---------- scenario 4: Saturday → never due ---------- */
console.log('\n[4] Saturday')
reset()
;(globalThis as any).Date = class extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(SATURDAY_MS)
    else super(...(args as []))
  }
  static now(): number {
    return SATURDAY_MS
  }
}
c = checkSundayBackup(sundayTrades)
check('not Sunday', c.isSunday === false, c)
check('not due', c.due === false, c)

/* ---------- scenario 5: Sunday but no trades this week ---------- */
console.log('\n[5] Sunday, zero trades this week')
reset()
;(globalThis as any).Date = FakeDate
c = checkSundayBackup([makeTrade(PREV_WEEK_MS, 'old')])
check('weekTrades = 0', c.weekTrades === 0, c)
check('not due', c.due === false, c)

/* ---------- scenario 6: simulate-sunday override via location ---------- */
console.log('\n[6] ?simulate-sunday URL override')
;(globalThis as any).location = new URL('http://localhost:4173/?simulate-sunday')
c = checkSundayBackup(sundayTrades)
check('override forces isSunday', c.isSunday === true, c)
check('due via override', c.due === true, c)
;(globalThis as any).location = undefined
// remove the override AND swap the frozen clock to Saturday → must not be due
;(globalThis as any).Date = class extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(SATURDAY_MS)
    else super(...(args as []))
  }
  static now(): number {
    return SATURDAY_MS
  }
}
c = checkSundayBackup(sundayTrades)
check('override removed + Saturday → not due', c.due === false && c.isSunday === false, c)
;(globalThis as any).Date = FakeDate

/* ---------- done ---------- */
console.log(failures === 0 ? '\nALL PASS ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
