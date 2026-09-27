/* eslint-disable @typescript-eslint/no-explicit-any */
// End-to-end round-trip test: export → clear → restore (replace & merge) → verify.
// Freezes nothing except browser globals; runs the REAL buildPayload/parseBackup/
// applyClear/applyImport code paths. Run with: npx tsx scripts/test-roundtrip.ts

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.error(`  ✗ ${name}`, extra ?? '')
  }
}

/* ---------- browser stubs (backup.ts touches localStorage only via callers; document/URL via download) ---------- */
;(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
}
;(globalThis as any).document = { body: { appendChild: () => {} }, createElement: () => ({ click() {}, remove() {} }) }

/* ---------- stable stringify for deep comparison ---------- */
function stable(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

const { buildPayload, parseBackup } = await import('../src/lib/backup.ts')
const { applyClear, applyImport } = await import('../src/lib/importMerge.ts')

function makeTrade(id: string, createdAt: number, over: Partial<any> = {}) {
  return {
    id, date: '2026-09-24', time: '09:30', session: 'London', killzone: 'ny',
    pair: 'XAUUSD', direction: 'long' as const, setup: 'OB retest',
    biasHTF: 'bullish' as const, biasMTF: 'bullish' as const, biasLTF: 'bearish' as const,
    poi: 'OB', entryModel: 'MSS / CHoCH',
    entry: 2650.5, stopLoss: 2645, takeProfit: 2665, exit: 2664,
    lots: 0.3, riskPercent: 1, balance: 5000,
    result: 'win' as const, confidence: 4,
    emotions: ['calm', 'confident'],
    notes: 'Clean displacement, waited for the retest.',
    lessons: 'Held to TP this time.',
    entryReason: 'HTF bullish + OB + MSS',
    exitReason: 'TP hit',
    followedPlan: true, screenshotUrl: 'https://example.com/shot.png',
    createdAt, ...over,
  }
}

const ORIGINAL = {
  trades: [
    makeTrade('t1', 1000),
    makeTrade('t2', 2000, { pair: 'EURUSD', direction: 'short' as const, result: 'loss' as const, exit: 2647, emotions: ['fomo'], followedPlan: false, date: '2026-09-25' }),
    makeTrade('t3', 3000, { result: 'open' as const, exit: null }),
  ],
  checklists: {
    '2026-09-24': { followedPlan: true, respectedRisk: true, noRevenge: false, noOvertrade: false, journaled: true, stoppedAtLimit: false },
    '2026-09-25': { followedPlan: false, respectedRisk: true, noRevenge: true, noOvertrade: false, journaled: true, stoppedAtLimit: false },
  },
  dayNotes: {
    '2026-09-24': { riskPerTrade: 1, biggestLearning: 'Patience pays', planForTomorrow: 'Only NY killzone' },
    '2026-09-25': { riskPerTrade: 0.5, biggestLearning: '', planForTomorrow: 'Review FOMO triggers' },
  },
  aiConfig: { provider: 'openai' as const, apiKey: 'sk-test-123', model: 'gpt-4o-mini' },
  aiHistory: [
    { id: 'm1', role: 'user' as const, content: 'How am I doing?', at: 111 },
    { id: 'm2', role: 'assistant' as const, content: 'Solid week.', at: 112 },
  ],
}

/* ---------- 1. EXPORT ---------- */
console.log('\n[1] export with buildPayload')
const payload = buildPayload(ORIGINAL as any)
const fileText = JSON.stringify(payload, null, 2)
check('payload contains all 3 trades', payload.trades.length === 3)
check('payload contains checklists', Object.keys(payload.checklists).length === 2)
check('payload contains dayNotes', payload.dayNotes?.['2026-09-24']?.biggestLearning === 'Patience pays')

/* ---------- 2. the "file" is re-read through the real parser ---------- */
console.log('\n[2] file parsed back with parseBackup (sanitizer on the way in)')
const restored = parseBackup(fileText)
check('parser kept 3 trades', restored.trades.length === 3)
check('parser kept full trade fidelity', stable(restored.trades) === stable(ORIGINAL.trades))
check('parser kept checklists', stable(restored.checklists) === stable(ORIGINAL.checklists))
check('parser kept dayNotes', stable(restored.dayNotes) === stable(ORIGINAL.dayNotes))
check('parser kept aiConfig', stable(restored.aiConfig) === stable(ORIGINAL.aiConfig))
check('parser kept aiHistory', stable(restored.aiHistory) === stable(ORIGINAL.aiHistory))

/* ---------- 3. CLEAR ---------- */
console.log('\n[3] clearAll via applyClear')
const cleared = applyClear(ORIGINAL as any)
check('trades wiped', cleared.trades.length === 0)
check('checklists wiped', Object.keys(cleared.checklists).length === 0)
check('dayNotes wiped', Object.keys(cleared.dayNotes).length === 0)
check('AI history wiped', cleared.aiHistory.length === 0)
check('AI config KEPT (so you stay logged in)', stable(cleared.aiConfig) === stable(ORIGINAL.aiConfig))

/* ---------- 4. RESTORE (replace) ---------- */
console.log('\n[4] restore replace via applyImport')
const back = applyImport(cleared, restored as any, 'replace')
check('all 3 trades back', back.trades.length === 3)
check('trades identical to original (order: newest first)', stable(back.trades) === stable([...ORIGINAL.trades].sort((a, b) => b.createdAt - a.createdAt)))
check('checklists identical', stable(back.checklists) === stable(ORIGINAL.checklists))
check('dayNotes identical', stable(back.dayNotes) === stable(ORIGINAL.dayNotes))
check('aiConfig restored from file', stable(back.aiConfig) === stable(ORIGINAL.aiConfig))
check('aiHistory restored', stable(back.aiHistory) === stable(ORIGINAL.aiHistory))
check('newest trade first (t3)', back.trades[0]?.id === 't3')

/* ---------- 5. REPLACE with an old-format file missing aiConfig ---------- */
console.log('\n[5] replace with file lacking aiConfig/aiHistory keeps current settings')
const oldFile = parseBackup(JSON.stringify({ version: 1, exportedAt: '2026-01-01', trades: ORIGINAL.trades, checklists: ORIGINAL.checklists }))
const back2 = applyImport(cleared, oldFile as any, 'replace')
check('trades still restored', back2.trades.length === 3)
check('aiConfig kept from current state', stable(back2.aiConfig) === stable(ORIGINAL.aiConfig))
check('aiHistory empty (file had none)', back2.aiHistory.length === 0)

/* ---------- 6. MERGE: duplicate + new trade + overlaps ---------- */
console.log('\n[6] merge mode')
const stateA = {
  trades: [makeTrade('t1', 1000), makeTrade('t2', 2000, { pair: 'EURUSD', direction: 'short' as const, result: 'loss' as const, exit: 2647, date: '2026-09-25' })],
  checklists: { '2026-09-24': { followedPlan: true, respectedRisk: false, noRevenge: true, noOvertrade: false, journaled: false, stoppedAtLimit: false } },
  dayNotes: { '2026-09-24': { riskPerTrade: 1, biggestLearning: 'Patience pays', planForTomorrow: '' } },
  aiConfig: ORIGINAL.aiConfig,
  aiHistory: [],
} as any
// incoming: t1 same id but NEWER with an edit, t9 brand new, t2 exact duplicate by content
const incoming = {
  trades: [
    makeTrade('t1', 5000, { lessons: 'EDITED on other device' }),
    makeTrade('t9', 6000, { pair: 'US30' }),
    makeTrade('t2', 2000, { pair: 'EURUSD', direction: 'short' as const, result: 'loss' as const, exit: 2647, date: '2026-09-25' }),
  ],
  checklists: { '2026-09-24': { followedPlan: false, respectedRisk: true, noRevenge: false, noOvertrade: false, journaled: true, stoppedAtLimit: false } },
  dayNotes: { '2026-09-24': { riskPerTrade: 0.5, biggestLearning: '', planForTomorrow: 'Only NY killzone' } },
} as any
const merged = applyImport(stateA, incoming, 'merge')
check('3 unique trades (no dupes)', merged.trades.length === 3, merged.trades.map(t => t.id))
check('newer edit of t1 won', merged.trades.find(t => t.id === 't1')?.lessons === 'EDITED on other device')
check('new trade t9 present', merged.trades.some(t => t.id === 't9'))
check('checklist OR-merged', merged.checklists['2026-09-24'].followedPlan === true
  && merged.checklists['2026-09-24'].respectedRisk === true
  && merged.checklists['2026-09-24'].journaled === true)
check('dayNotes merged (new risk wins, texts combined)', merged.dayNotes['2026-09-24'].riskPerTrade === 0.5
  && merged.dayNotes['2026-09-24'].biggestLearning === 'Patience pays'
  && merged.dayNotes['2026-09-24'].planForTomorrow === 'Only NY killzone')
check('current aiConfig untouched in merge', stable(merged.aiConfig) === stable(ORIGINAL.aiConfig))

/* ---------- 7. HOSTILE / CORRUPT FILES ---------- */
console.log('\n[7] corrupt & foreign files')
function throwsWith(text: string, re: RegExp): boolean {
  try {
    parseBackup(text)
    return false
  } catch (e) {
    return re.test(e instanceof Error ? e.message : String(e))
  }
}
check('not JSON → friendly error', throwsWith('this is not json', /not valid JSON/))
check('empty object → friendly error', throwsWith('{}', /GT2FX backup/))
check('trades not an array → friendly error', throwsWith('{"trades": "nope"}', /No trades found/))
const hostile = parseBackup(JSON.stringify({
  trades: [
    { date: 'not-a-date', pair: 'xauusd', direction: 'sideways', result: 'rekt', confidence: 99, entry: 'abc', emotions: ['ok', 42, null] },
    null,
    'garbage',
    42,
  ],
  checklists: { 'nope': { followedPlan: 'yes' }, '2026-09-24': { followedPlan: true, respectedRisk: 'x', noRevenge: 1, noOvertrade: [], journaled: 'true', stoppedAtLimit: null } },
  dayNotes: { 'bad-date': { biggestLearning: null }, '2026-09-24': { riskPerTrade: '1', biggestLearning: 42, planForTomorrow: true } },
}))
check('hostile entries dropped, valid ones kept', hostile.trades.length === 1)
const ht = hostile.trades[0]
check('bad date → today', ht.date === new Date().toISOString().slice(0, 10))
check('bad direction → long', ht.direction === 'long')
check('bad result → open', ht.result === 'open')
check('confidence clamped 1-5', ht.confidence === 5)
check('bad entry → null', ht.entry === null)
check('non-string emotions dropped', stable(ht.emotions) === '["ok"]')
check('bad checklist dates dropped', !('nope' in hostile.checklists) && '2026-09-24' in hostile.checklists)
check('only strict true survives boolean coercion', hostile.checklists['2026-09-24'].followedPlan === true
  && hostile.checklists['2026-09-24'].respectedRisk === false
  && hostile.checklists['2026-09-24'].noRevenge === false
  && hostile.checklists['2026-09-24'].noOvertrade === false
  && hostile.checklists['2026-09-24'].journaled === false
  && hostile.checklists['2026-09-24'].stoppedAtLimit === false)
check('bad dayNotes dates dropped', !('bad-date' in (hostile.dayNotes ?? {})))
check('dayNotes non-strings blanked, bad numbers nulled', hostile.dayNotes?.['2026-09-24']?.riskPerTrade === null
  && hostile.dayNotes?.['2026-09-24']?.biggestLearning === ''
  && hostile.dayNotes?.['2026-09-24']?.planForTomorrow === '')

/* ---------- done ---------- */
console.log(failures === 0 ? '\nALL PASS ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
