import type { AIMessage, AIProvider, Bias, ChecklistState, Trade } from '../types'
import { calcTrade, fmtMoney, fmtR, summarize } from './calc'
import { PAIR_MATCH_SOURCE, resolvePair } from './pairs'

/* ------------------------------------------------------------------ */
/* Context building — a compact snapshot of the journal for the model  */
/* ------------------------------------------------------------------ */

export function buildContext(trades: Trade[], checklist: ChecklistState): string {
  const closed = trades.filter(t => t.result !== 'open')
  const s = summarize(closed)
  const total = s.wins + s.losses + s.breakeven
  const winRate = total > 0 ? Math.round((s.wins / total) * 100) : null

  const pairs = new Map<string, { n: number; pnl: number }>()
  for (const t of closed) {
    const c = calcTrade(t)
    const e = pairs.get(t.pair) ?? { n: 0, pnl: 0 }
    e.n++
    if (c.pnl !== null) e.pnl += c.pnl
    pairs.set(t.pair, e)
  }
  const pairLine = [...pairs.entries()]
    .map(([p, e]) => `${p}: ${e.n} trades, ${fmtMoney(e.pnl)}`)
    .join('; ')

  const recent = trades
    .slice(0, 10)
    .map(t => {
      const c = calcTrade(t)
      return [
        `${t.date} ${t.time} ${t.pair} ${t.direction}`,
        `entry=${t.entry ?? '?'} sl=${t.stopLoss ?? '?'} tp=${t.takeProfit ?? '?'} exit=${t.exit ?? '-'}`,
        `lots=${t.lots ?? '?'} risk=${t.riskPercent ?? '?'}% result=${t.result}`,
        c.rr !== null ? `RR=${c.rr.toFixed(2)}` : null,
        c.rMultiple !== null ? `R=${c.rMultiple.toFixed(2)}` : null,
        t.emotions.length ? `emotions=${t.emotions.join('/')}` : null,
        t.setup ? `setup=${t.setup}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    })
    .join('\n')

  const checks = Object.entries(checklist)
    .filter(([, v]) => Object.values(v).some(Boolean))
    .length

  return [
    `Journal snapshot: ${trades.length} trades total, ${total} closed.`,
    winRate !== null ? `Win rate ${winRate}% | Net P/L ${fmtMoney(s.netPnl)} | Net ${fmtR(s.netR)}` : 'No closed trades yet.',
    pairLine ? `By pair — ${pairLine}` : '',
    `Daily psychology checklists filled on ${checks} day(s).`,
    recent ? `Recent trades:\n${recent}` : 'No trades logged yet.',
  ]
    .filter(Boolean)
    .join('\n')
}

export const SYSTEM_PROMPT = `You are the GT2FX trading journal coach. You help a retail trader (mostly XAUUSD/forex) journal trades, review risk management, and build discipline.
Rules:
- Be concise, direct and practical. Use short paragraphs or bullet lists.
- When asked to fill a trade, reply with a line starting with FILL: followed by key=value pairs (pair, direction, entry, sl, tp, exit, lots, riskPercent, result, session, killzone as asia|london|ny|lclose, setup, notes, confidence 1-5, emotions comma-separated, biashtf/biasmtf/biasltf as bullish|bearish|range, poi, model, entryreason, exitreason, lesson, followedplan yes|no). Example: FILL: pair=XAUUSD direction=long biashtf=bullish poi=OB model=MSS entry=2650.5 sl=2646 tp=2662 lots=0.3 entryreason="OB retest with displacement"
- When the user provides a chart/platform screenshot, read the visible pair, direction (buy/sell), entry, SL, TP, exit if shown, lots/size, and any on-chart labels. Reply with FILL: key=value pairs using the existing keys. If a value is unclear, omit it rather than guessing. Still answer normal text coaching when no image is provided.
- Critique entries honestly: flag weak R:R (<1.5), missing SL, oversized risk (>2%), revenge/emotion words, overtrading.
- Encourage process over profits. Never give financial advice or predict markets.`

/* ------------------------------------------------------------------ */
/* Trade parsing from free text (offline + helper for real AI too)     */
/* ------------------------------------------------------------------ */

const PAIR_RE = new RegExp(`\\b(${PAIR_MATCH_SOURCE})\\b`, 'i')

export interface ParsedFill {
  patch: Partial<Trade>
  missing: string[]
}

export function parseFillText(text: string): ParsedFill | null {
  const m = text.match(/FILL:\s*(.+)/i)
  if (!m) return null
  const body = m[1]
  const kv: Record<string, string> = {}
  // key=value with optional double-quoted values that may contain spaces
  const re = /([A-Za-z_]+)="([^"]*)"|([A-Za-z_]+)=([^\s]+)/g
  let km: RegExpExecArray | null
  while ((km = re.exec(body)) !== null) {
    const key = (km[1] ?? km[3] ?? '').toLowerCase()
    const val = km[2] ?? km[4] ?? ''
    if (key) kv[key] = val
  }
  const patch: Partial<Trade> = {}
  const num = (v: string | undefined): number | null =>
    v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v)

  if (kv.pair) patch.pair = resolvePair(kv.pair)
  for (const tf of ['htf', 'mtf', 'ltf'] as const) {
    const raw = kv[`bias${tf}`] ?? kv[tf]
    const v = raw?.toLowerCase()
    if (v && ['bullish', 'bull', 'bearish', 'bear', 'range', 'ranging'].includes(v)) {
      const bias: Bias = v.startsWith('bull') ? 'bullish' : v.startsWith('bear') ? 'bearish' : 'range'
      patch[tf === 'htf' ? 'biasHTF' : tf === 'mtf' ? 'biasMTF' : 'biasLTF'] = bias
    }
  }
  if (kv.poi) patch.poi = kv.poi
  const model = kv.model ?? kv.entrymodel
  if (model) patch.entryModel = model
  if (kv.direction === 'long' || kv.direction === 'buy' || kv.direction === 'short' || kv.direction === 'sell')
    patch.direction = kv.direction === 'long' || kv.direction === 'buy' ? 'long' : 'short'
  const entry = num(kv.entry)
  if (entry !== null) patch.entry = entry
  const sl = num(kv.sl)
  if (sl !== null) patch.stopLoss = sl
  const tp = num(kv.tp)
  if (tp !== null) patch.takeProfit = tp
  const exit = num(kv.exit)
  if (exit !== null) patch.exit = exit
  const lots = num(kv.lots)
  if (lots !== null) patch.lots = lots
  const rp = num(kv.riskpercent)
  if (rp !== null) patch.riskPercent = rp
  const conf = num(kv.confidence)
  if (conf !== null) patch.confidence = Math.min(5, Math.max(1, conf))
  if (kv.result && ['win', 'loss', 'breakeven', 'open'].includes(kv.result.toLowerCase()))
    patch.result = kv.result.toLowerCase() as Trade['result']
  if (kv.session) patch.session = kv.session
  if (kv.killzone) patch.killzone = kv.killzone.toLowerCase()
  if (kv.setup) patch.setup = kv.setup
  if (kv.entryreason) patch.entryReason = kv.entryreason
  if (kv.exitreason) patch.exitReason = kv.exitreason
  if (kv.lesson) patch.lessons = kv.lesson
  if (kv.followedplan) patch.followedPlan = /^(yes|y|true|1)$/i.test(kv.followedplan)
  if (kv.notes) patch.notes = kv.notes
  if (kv.emotions) patch.emotions = kv.emotions.split(',').map(e => e.trim()).filter(Boolean)

  const missing: string[] = []
  if (!patch.pair) missing.push('pair')
  if (patch.entry === undefined) missing.push('entry')
  if (patch.stopLoss === undefined) missing.push('stop loss')
  if (patch.takeProfit === undefined) missing.push('take profit')

  return Object.keys(patch).length ? { patch, missing } : null
}

/** Heuristic single-line trade parser used in offline mode: "bought gold 2650 sl 2645 tp 2665" */
export function parsePlainTrade(text: string): Partial<Trade> | null {
  const lower = text.toLowerCase()
  const pairMatch = lower.match(PAIR_RE)
  const dirBuy = /\b(buy|bought|long|bullish)\b/.test(lower)
  const dirSell = /\b(sell|sold|short|bearish)\b/.test(lower)
  const nums = [...lower.matchAll(/(?:@|at|entry|e)?\s*(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]))
  const sl = lower.match(/\bsl\s*(?:@|:|=)?\s*(\d+(?:\.\d+)?)/)
  const tp = lower.match(/\b(tp|target)\s*(?:@|:|=)?\s*(\d+(?:\.\d+)?)/)
  const lots = lower.match(/(\d+(?:\.\d+)?)\s*(?:lots?|size)\b/)

  if (!pairMatch && !dirBuy && !dirSell && !sl && !tp) return null
  const patch: Partial<Trade> = {}
  if (pairMatch) patch.pair = resolvePair(pairMatch[1])
  if (dirBuy !== dirSell) patch.direction = dirBuy ? 'long' : 'short'
  if (sl) patch.stopLoss = Number(sl[1])
  if (tp) patch.takeProfit = Number(tp[2] ?? tp[1])
  if (lots) patch.lots = Number(lots[1])
  const slv = patch.stopLoss
  const tpv = patch.takeProfit
  if (nums.length && slv !== undefined && tpv !== undefined) {
    const candidates = nums.filter(n => n !== slv && n !== tpv)
    if (candidates.length) patch.entry = candidates[candidates.length - 1]
  } else if (nums.length) {
    patch.entry = nums[0]
  }
  return Object.keys(patch).length ? patch : null
}

/* ------------------------------------------------------------------ */
/* Offline coach                                                       */
/* ------------------------------------------------------------------ */

function withPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function offlineReply(
  input: string,
  trades: Trade[],
  checklist: ChecklistState,
): string {
  const lower = input.toLowerCase()
  const closed = trades.filter(t => t.result !== 'open')
  const s = summarize(closed)
  const total = s.wins + s.losses + s.breakeven
  const winRate = total ? s.wins / total : null

  // 1) Try to parse a trade to fill
  const plain = parsePlainTrade(input)
  if (plain && (plain.entry !== undefined || plain.stopLoss !== undefined)) {
    const c = calcTrade({ ...(plain as Trade) })
    const aliasNote = plain.pair && plain.pair !== plain.pair.toUpperCase() ? ` (${plain.pair})` : ''
    const bits = [`Parsed a ${plain.direction ?? ''} ${plain.pair ?? 'trade'}${aliasNote}`.replace(/\s+/g, ' ') + '.']
    if (c.rr !== null) bits.push(`Planned R:R ≈ ${c.rr.toFixed(2)} ${c.rr >= 2 ? '✅ solid' : c.rr >= 1.5 ? '⚠️ acceptable' : '❌ below 1.5 — consider skipping or improving the target'}.`)
    if (c.suggestedLots !== null && plain.riskPercent === undefined)
      bits.push(`At 1% risk the suggested size would be ~${c.suggestedLots} lots.`)
    bits.push('Say "fill it" or tap Apply on the form to log this trade — add SL/TP if missing.')
    return bits.join(' ')
  }

  // 2) Stats questions
  if (/(win ?rate|how am i|stats|summary|performance|review)/.test(lower)) {
    if (!total) return 'No closed trades yet. Log a few — I can then analyze win rate, R:R quality and emotional patterns.'
    const parts = [
      `You have ${total} closed trades: ${s.wins}W / ${s.losses}L / ${s.breakeven}BE — win rate ${winRate ? withPct(winRate) : '—'}.`,
      `Net P/L ${fmtMoney(s.netPnl)}, net ${fmtR(s.netR)}.`,
    ]
    if (s.netR < 0 && winRate && winRate > 0.5)
      parts.push('⚠️ Positive win rate but negative R — your winners are smaller than your losers. Let winners run to plan or cut losers earlier.')
    if (s.netR > 0 && winRate && winRate < 0.45)
      parts.push('✅ Low win rate but positive R — that works as long as R:R stays above ~2 and you keep risk fixed.')
    const emotions = new Map<string, number>()
    for (const t of closed) for (const e of t.emotions) emotions.set(e, (emotions.get(e) ?? 0) + 1)
    const topEmotion = [...emotions.entries()].sort((a, b) => b[1] - a[1])[0]
    if (topEmotion && topEmotion[1] >= 2) parts.push(`Most common emotion: ${topEmotion[0]} (${topEmotion[1]}×). Watch for it before entries.`)
    return parts.join(' ')
  }

  // 3) Risk sizing
  if (/(lot|size|position|risk)/.test(lower)) {
    const bal = Number(lower.match(/(\d{3,})/)?.[1] ?? 0) || 0
    const risk = Number(lower.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 1)
    if (bal) {
      const amount = (risk / 100) * bal
      return `With $${bal.toLocaleString()} and ${risk}% risk per trade, that's $${amount.toFixed(2)} max loss. For XAUUSD with a $5 stop distance, size ≈ ${(amount / 50).toFixed(2)} lots. Give me entry+SL and I'll compute the exact size.`
    }
    return 'Position sizing rule: lots = risk$ / (SL pips × pip value). Keep risk at 0.5–1% per trade, max 3% total daily. Tell me your balance, entry and SL and I\'ll size it.'
  }

  // 4) Psychology / checklist
  if (/(psycholog|emotion|discipline|revenge|tilt|checklist|habit|plan)/.test(lower)) {
    const filled = Object.values(checklist).filter(Boolean).length
    const tips = [
      filled ? `You've filled the daily checklist ${filled} time(s).` : 'Tip: fill the psychology checklist each day — patterns show up fast.',
      'Before every entry ask: "Is this in my plan, or am I bored/revenge/FOMO?" If it\'s not in the plan, it\'s a no.',
      'After 2 losses, stop for the day. Recovery mode is where accounts die.',
    ]
    return tips.join(' ')
  }

  // 5) Lessons
  if (/(lesson|learn|improve|mistake|better)/.test(lower)) {
    const losses = closed.filter(t => t.result === 'loss')
    if (!losses.length) return 'No losses logged yet — when you have some, I\'ll extract lessons from them (that\'s where the edge is built).'
    const noSl = losses.filter(t => t.stopLoss === null).length
    const lowRr = losses.filter(t => {
      const c = calcTrade(t)
      return c.rr !== null && c.rr < 1.5
    }).length
    const emotional = losses.filter(t => t.emotions.some(e => ['fomo', 'revengeful', 'greedy', 'impatient'].includes(e))).length
    const lines = [
      `From ${losses.length} losses:`,
      noSl ? `• ${noSl} trade(s) had no stop loss — that's rule #1 broken.` : '• Stops were defined ✅',
      lowRr ? `• ${lowRr} had R:R below 1.5 — losers like these make the math impossible.` : '• R:R was acceptable ✅',
      emotional ? `• ${emotional} were tagged with fomo/revenge/greed/impatience — the leak is emotional, not technical.` : '• Emotions were tagged calm/confident ✅',
      'Pick ONE leak to fix this week and track it in the checklist.',
    ]
    return lines.join('\n')
  }

  // 6) Screenshot / vision fill help
  const wantsVisionHelp =
    /\bscreenshots?\b/.test(lower) ||
    /\bvision\b/.test(lower) ||
    (lower.includes('image') && /(fill|attach|read|send|upload|scan|chart)/.test(lower))
  if (wantsVisionHelp) {
    return [
      'Screenshot fill reads a chart for you:',
      '1. Tap 📎 beside the message box and pick a chart/platform screenshot (or paste one in).',
      '2. It needs a real AI provider with a vision model — add your key in ⚙️ (OpenAI gpt-4o-mini, Gemini gemini-2.0-flash or OpenRouter openai/gpt-4o-mini).',
      '3. Send it and I\'ll read the pair, direction, entry, SL, TP, exit and lots, then reply with a FILL: line.',
      '4. Tap "Apply to form →" to prefill the trade. Anything unclear is left out rather than guessed.',
      'The image stays on your device — it\'s sent only to the provider you chose. Offline mode can still fill trades from text.',
    ].join('\n')
  }

  // 7) Help / default
  return [
    'I\'m your offline journal coach. I can:',
    '• Fill a trade — type it like: "bought gold 2650 sl 2645 tp 2665 0.3 lots"',
    '• Screenshot fill — attach a chart image (needs a real AI key)',
    '• Review stats — "how am I doing?"',
    '• Size positions — "balance 5000, risk 1%"',
    '• Extract lessons — "what are my mistakes?"',
    '• Talk psychology — "I keep revenge trading"',
    'For deeper answers, connect a real AI key in ⚙️ settings.',
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* Real AI providers                                                   */
/* ------------------------------------------------------------------ */

interface CallOpts {
  provider: AIProvider
  apiKey: string
  model: string
  system: string
  context: string
  history: AIMessage[]
  input: string
  /** Optional data URL (data:image/...;base64,...) for vision-capable models */
  imageDataUrl?: string
}

/** Split a `data:image/...;base64,...` URL into the parts Gemini's inlineData wants. */
function dataUrlToGeminiPart(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/s)
  if (!m) return null
  return { mimeType: m[1], data: m[2] }
}

export async function callAI(opts: CallOpts): Promise<string> {
  const messagesText = opts.history
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n')
  void messagesText

  if (opts.provider === 'gemini') {
    // gemini-2.0-flash is vision-capable, so an empty model still reads screenshots
    const model = opts.model || 'gemini-2.0-flash'
    const imagePart = opts.imageDataUrl ? dataUrlToGeminiPart(opts.imageDataUrl) : null
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${opts.system}\n\n${opts.context}` }] },
          contents: [
            ...opts.history.slice(-8).map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            {
              role: 'user',
              parts: imagePart
                ? [{ text: opts.input }, { inlineData: imagePart }]
                : [{ text: opts.input }],
            },
          ],
          generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
        }),
      },
    )
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    if (!text) throw new Error('Gemini returned an empty response')
    return text
  }

  // OpenAI-compatible (openai + openrouter)
  const base =
    opts.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  const model =
    opts.model ||
    (opts.provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 800,
      messages: [
        { role: 'system', content: `${opts.system}\n\n${opts.context}` },
        ...opts.history.slice(-8).map(m => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          // Multimodal content array when a screenshot is attached (gpt-4o-mini is vision-capable)
          content: opts.imageDataUrl
            ? [
                { type: 'text', text: opts.input },
                { type: 'image_url', image_url: { url: opts.imageDataUrl } },
              ]
            : opts.input,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('The AI returned an empty response')
  return text
}
