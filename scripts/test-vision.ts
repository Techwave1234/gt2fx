/* eslint-disable @typescript-eslint/no-explicit-any */
// Vision payload tests: run the REAL callAI() against a stubbed fetch and assert the
// exact request bodies sent to OpenAI / OpenRouter / Gemini — with and without an image.
// No network is used. Run with: npx tsx scripts/test-vision.ts

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failures++
    console.error(`  ✗ ${name}`, extra ?? '')
  }
}

/* ---------- stub fetch so we can inspect what callAI actually sends ---------- */
const IMG = 'data:image/png;base64,' + 'A'.repeat(64)
const IMG_DATA = 'A'.repeat(64)

let captured: { url: string; body: any }[] = []

function stubFetch(responder: (url: string) => any) {
  captured = []
  ;(globalThis as any).fetch = async (url: string, init: any) => {
    captured.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null })
    const r = responder(String(url)) ?? {}
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      text: async () => JSON.stringify(r.json ?? {}),
      json: async () => r.json ?? {},
    }
  }
}

const OPENAI_OK = { json: { choices: [{ message: { content: 'FILL: pair=XAUUSD direction=long entry=2650 sl=2645 tp=2665' } }] } }
const GEMINI_OK = { json: { candidates: [{ content: { parts: [{ text: 'FILL: pair=EURUSD direction=short entry=1.085 sl=1.089 tp=1.077' }] } }] } }

const { callAI, parseFillText, offlineReply } = await import('../src/lib/ai.ts')

const base = {
  apiKey: 'sk-test',
  system: 'SYS',
  context: 'CTX',
  history: [] as any[],
  input: 'read this chart',
}

/* ---------- 1. OpenAI + image ---------- */
console.log('\n[1] OpenAI with screenshot')
stubFetch(() => OPENAI_OK)
let reply = await callAI({ ...base, provider: 'openai', model: '', imageDataUrl: IMG })
let req = captured[0]
check('hits OpenAI chat/completions', req.url === 'https://api.openai.com/v1/chat/completions', req.url)
check('empty model → vision default gpt-4o-mini', req.body.model === 'gpt-4o-mini', req.body.model)
check('2 messages (system + user)', req.body.messages.length === 2, req.body.messages.length)
check('user content is an array (multimodal)', Array.isArray(req.body.messages[1].content), req.body.messages[1].content)
check('part[0] is the text', req.body.messages[1].content[0].type === 'text' && req.body.messages[1].content[0].text === 'read this chart', req.body.messages[1].content[0])
check('part[1] is image_url with the full data URL', req.body.messages[1].content[1].type === 'image_url'
  && req.body.messages[1].content[1].image_url.url === IMG, req.body.messages[1].content[1])
check('system carries system + context', req.body.messages[0].content.includes('SYS') && req.body.messages[0].content.includes('CTX'))
check('reply parses as a fill', parseFillText(reply)?.patch.pair === 'XAUUSD', reply)

/* ---------- 2. OpenAI WITHOUT image keeps the old string body ---------- */
console.log('\n[2] OpenAI text-only (regression guard)')
stubFetch(() => OPENAI_OK)
await callAI({ ...base, provider: 'openai', model: '' })
check('user content stays a plain string', captured[0].body.messages[1].content === 'read this chart', captured[0].body.messages[1].content)

/* ---------- 3. OpenRouter ---------- */
console.log('\n[3] OpenRouter with screenshot')
stubFetch(() => OPENAI_OK)
await callAI({ ...base, provider: 'openrouter', model: '', imageDataUrl: IMG })
check('hits OpenRouter base', captured[0].url === 'https://openrouter.ai/api/v1/chat/completions', captured[0].url)
check('empty model → openai/gpt-4o-mini', captured[0].body.model === 'openai/gpt-4o-mini', captured[0].body.model)
check('image_url present', captured[0].body.messages[1].content[1].image_url.url === IMG)

/* ---------- 4. Gemini + image ---------- */
console.log('\n[4] Gemini with screenshot')
stubFetch(() => GEMINI_OK)
reply = await callAI({ ...base, provider: 'gemini', model: '', imageDataUrl: IMG })
req = captured[0]
check('hits Gemini generateContent', req.url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/'), req.url)
check('model default gemini-2.0-flash in URL', req.url.includes('/gemini-2.0-flash:generateContent'), req.url)
check('key in URL', req.url.includes('key=sk-test'))
check('one user turn', req.body.contents.length === 1 && req.body.contents[0].role === 'user', req.body.contents)
check('parts = [text, inline_data]', req.body.contents[0].parts.length === 2, req.body.contents[0].parts)
check('text part correct', req.body.contents[0].parts[0].text === 'read this chart')
check('inline_data mime_type correct', req.body.contents[0].parts[1].inline_data.mime_type === 'image/png', req.body.contents[0].parts[1])
check('inline_data data has the prefix stripped', req.body.contents[0].parts[1].inline_data.data === IMG_DATA)
check('systemInstruction present', req.body.systemInstruction.parts[0].text.includes('SYS'))
check('reply parses as a fill', parseFillText(reply)?.patch.pair === 'EURUSD', reply)

/* ---------- 5. Gemini WITHOUT image ---------- */
console.log('\n[5] Gemini text-only (regression guard)')
stubFetch(() => GEMINI_OK)
await callAI({ ...base, provider: 'gemini', model: '' })
check('parts = [text] only', captured[0].body.contents[0].parts.length === 1 && !captured[0].body.contents[0].parts[1], captured[0].body.contents[0].parts)

/* ---------- 6. Explicit models are respected ---------- */
console.log('\n[6] explicit model wins over the default')
stubFetch(() => OPENAI_OK)
await callAI({ ...base, provider: 'openai', model: 'gpt-4.1', imageDataUrl: IMG })
check('OpenAI uses the given model', captured[0].body.model === 'gpt-4.1', captured[0].body.model)
stubFetch(() => GEMINI_OK)
await callAI({ ...base, provider: 'gemini', model: 'gemini-1.5-pro', imageDataUrl: IMG })
check('Gemini uses the given model', captured[0].url.includes('/gemini-1.5-pro:generateContent'), captured[0].url)

/* ---------- 7. Malformed image data URL degrades gracefully ---------- */
console.log('\n[7] malformed image data URL')
stubFetch(() => GEMINI_OK)
await callAI({ ...base, provider: 'gemini', model: '', imageDataUrl: 'not-a-data-url' })
check('Gemini drops the bad image (text-only parts)', captured[0].body.contents[0].parts.length === 1, captured[0].body.contents[0].parts)
stubFetch(() => OPENAI_OK)
await callAI({ ...base, provider: 'openai', model: '', imageDataUrl: 'not-a-data-url' })
check('OpenAI still completes without throwing', captured[0].body.messages.length === 2)

/* ---------- 8. History mapping ---------- */
console.log('\n[8] conversation history is forwarded')
const history = [
  { id: 'a', role: 'user', content: 'hi', at: 1 },
  { id: 'b', role: 'assistant', content: 'hello', at: 2 },
]
stubFetch(() => OPENAI_OK)
await callAI({ ...base, provider: 'openai', model: '', history })
check('OpenAI: system + 2 history + user = 4', captured[0].body.messages.length === 4, captured[0].body.messages.length)
stubFetch(() => GEMINI_OK)
await callAI({ ...base, provider: 'gemini', model: '', history })
check('Gemini: 2 history + user = 3 turns', captured[0].body.contents.length === 3, captured[0].body.contents.length)
check('Gemini maps roles user/model', captured[0].body.contents[0].role === 'user' && captured[0].body.contents[1].role === 'model')

/* ---------- 9. Error paths surface the provider status ---------- */
console.log('\n[9] provider errors')
stubFetch(() => ({ ok: false, status: 401, json: { error: 'bad key' } }))
let msg = ''
try { await callAI({ ...base, provider: 'openai', model: '', imageDataUrl: IMG }) } catch (e) { msg = e instanceof Error ? e.message : String(e) }
check('OpenAI 401 throws a readable error', /API error 401/.test(msg), msg)
stubFetch(() => ({ ok: false, status: 429, json: { error: 'quota' } }))
msg = ''
try { await callAI({ ...base, provider: 'gemini', model: '', imageDataUrl: IMG }) } catch (e) { msg = e instanceof Error ? e.message : String(e) }
check('Gemini 429 throws a readable error', /Gemini error 429/.test(msg), msg)

/* ---------- 10. the offline coach explains screenshot fill ---------- */
console.log('\n[10] offline coach explains screenshot fill')
const emptyChecklist = {
  followedPlan: false,
  respectedRisk: false,
  noRevenge: false,
  noOvertrade: false,
  journaled: false,
  stoppedAtLimit: false,
}
const help = offlineReply('How does screenshot fill work?', [], emptyChecklist as any)
check('explains the 📎 attach flow', help.includes('📎'), help)
check('walks through the apply step', /Apply to form/i.test(help), help)
check('says it needs a real vision model', /vision/i.test(help), help)
check('also fires for "can you read this chart image?"', /Apply to form/i.test(offlineReply('can you read this chart image?', [], emptyChecklist as any)))
check('a plain greeting is not hijacked', !/Apply to form/i.test(offlineReply('hello there', [], emptyChecklist as any)))

/* ---------- done ---------- */
console.log(failures === 0 ? '\nALL PASS ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
