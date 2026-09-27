/* eslint-disable @typescript-eslint/no-explicit-any */
// Pre-trade checklist tests: alignmentOf + evalPreTrade across scenarios.
// Run with: npx tsx scripts/test-pretrade.ts

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.error(`  ✗ ${name}`, extra ?? '')
  }
}

const { alignmentOf, evalPreTrade, PRETRADE_CHECKS } = await import('../src/lib/pretrade.ts')

function makeTrade(over: Partial<any> = {}) {
  return {
    id: 'x', date: '2026-09-27', time: '08:30', session: 'New York', killzone: 'ny',
    pair: 'XAUUSD', direction: 'long' as const, setup: 'OB retest',
    biasHTF: 'bullish' as const, biasMTF: 'bullish' as const, biasLTF: 'bullish' as const,
    poi: 'OB', entryModel: 'MSS / CHoCH',
    entry: 2650, stopLoss: 2645, takeProfit: 2665, exit: null,
    lots: 0.3, riskPercent: 1, balance: 5000,
    result: 'open' as const, confidence: 4, emotions: [],
    notes: '', lessons: '', entryReason: 'HTF bullish + OB + MSS', exitReason: '',
    followedPlan: false, screenshotUrl: '', createdAt: 1,
    ...over,
  }
}

console.log('\n[1] perfect A+ trade passes everything')
let r = evalPreTrade(makeTrade())
check('8 checks evaluated', r.length === 8)
check('all pass', r.every(x => x.pass), r.filter(x => !x.pass).map(x => x.check.id))

console.log('\n[2] alignment matrix')
check('all bullish + long → ok', alignmentOf(makeTrade()) === 'ok')
check('all bearish + short → ok', alignmentOf(makeTrade({ direction: 'short', biasHTF: 'bearish', biasMTF: 'bearish', biasLTF: 'bearish' })) === 'ok')
check('HTF bull, LTF bear + long → partial', alignmentOf(makeTrade({ biasLTF: 'bearish' })) === 'partial')
check('HTF bear + long → counter', alignmentOf(makeTrade({ biasHTF: 'bearish' })) === 'counter')
check('any bias missing → none', alignmentOf(makeTrade({ biasMTF: '' })) === 'none')
check('range HTF → partial (caution, not counter)', alignmentOf(makeTrade({ biasHTF: 'range', biasMTF: 'range', biasLTF: 'range' })) === 'partial')
check('HTF bull + MTF range + long → partial', alignmentOf(makeTrade({ biasMTF: 'range' })) === 'partial')

console.log('\n[3] individual check failures')
const cases: [string, any, string][] = [
  ['no HTF bias', { biasHTF: '' }, 'htf'],
  ['R:R below 1.5', { takeProfit: 2652 }, 'rr'],
  ['risk above 2%', { riskPercent: 3 }, 'risk'],
  ['no killzone', { killzone: '' }, 'kz'],
  ['no POI', { poi: '' }, 'poi'],
  ['short entry reason', { entryReason: 'idk' }, 'reason'],
]
for (const [name, over, id] of cases) {
  const res = evalPreTrade(makeTrade(over)).find(x => x.check.id === id)
  check(`${name} → ${id} fails`, res?.pass === false, res)
}

console.log('\n[4] boundary values')
check('R:R exactly 1.5 passes', evalPreTrade(makeTrade({ takeProfit: 2657.5 })).find(x => x.check.id === 'rr')?.pass === true)
check('risk exactly 2% passes', evalPreTrade(makeTrade({ riskPercent: 2 })).find(x => x.check.id === 'risk')?.pass === true)
check('risk null passes (lenient)', evalPreTrade(makeTrade({ riskPercent: null })).find(x => x.check.id === 'risk')?.pass === true)
check('no SL fails', evalPreTrade(makeTrade({ stopLoss: null })).find(x => x.check.id === 'sl')?.pass === false)
check('5-char reason passes', evalPreTrade(makeTrade({ entryReason: '12345' })).find(x => x.check.id === 'reason')?.pass === true)

console.log('\n[5] check ids unique & stable')
check('unique ids', new Set(PRETRADE_CHECKS.map(c => c.id)).size === PRETRADE_CHECKS.length)

console.log(failures === 0 ? '\nALL PASS ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
