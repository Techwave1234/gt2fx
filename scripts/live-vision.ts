/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OPTIONAL live smoke test for screenshot fill.
 *
 * It uses YOUR OWN provider key from the environment — nothing is stored, printed, or sent
 * anywhere except the provider you pick. It is intentionally NOT part of `npm test`
 * (it needs network + a key).
 *
 *   OPENAI_API_KEY=sk-...        tsx scripts/live-vision.ts [path/to/chart.png]
 *   GEMINI_API_KEY=...           tsx scripts/live-vision.ts [path/to/chart.png]
 *   OPENROUTER_API_KEY=sk-or-... tsx scripts/live-vision.ts [path/to/chart.png]
 *
 * Pass an image path to test a real chart; without one it sends a tiny 1x1 PNG to prove
 * the multimodal payload is ACCEPTED end-to-end (some providers reject degenerate 1x1
 * images, so a real screenshot is the truer test).
 */

// 1x1 transparent PNG
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const { callAI, parseFillText, SYSTEM_PROMPT } = await import('../src/lib/ai.ts')

function mimeFor(p: string): string {
  const l = p.toLowerCase()
  if (l.endsWith('.png')) return 'image/png'
  if (l.endsWith('.webp')) return 'image/webp'
  if (l.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

let imageDataUrl = TINY_PNG
const imagePath = process.argv[2]
if (imagePath) {
  const { readFileSync } = await import('node:fs')
  const buf = readFileSync(imagePath)
  imageDataUrl = `data:${mimeFor(imagePath)};base64,${buf.toString('base64')}`
  console.log(`Using image ${imagePath} — ${Math.round(buf.length / 1024)} KB, ${mimeFor(imagePath)}`)
} else {
  console.log('No image path given — using a 1x1 PNG (some providers reject degenerate images).')
}

const providers: { provider: 'openai' | 'gemini' | 'openrouter'; env: string; model: string }[] = [
  { provider: 'openai', env: 'OPENAI_API_KEY', model: 'gpt-4o-mini' },
  { provider: 'openrouter', env: 'OPENROUTER_API_KEY', model: 'openai/gpt-4o-mini' },
  { provider: 'gemini', env: 'GEMINI_API_KEY', model: 'gemini-2.0-flash' },
]

const configured = providers.filter(p => process.env[p.env])
if (configured.length === 0) {
  console.log('No provider key found in the environment — nothing to do.')
  console.log('Set one of OPENAI_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY and re-run.')
  process.exit(0)
}

let failures = 0
for (const p of configured) {
  console.log(`\n--- ${p.provider} (${p.model}) ---`)
  try {
    const reply = await callAI({
      provider: p.provider,
      apiKey: process.env[p.env] as string,
      model: p.model,
      system: SYSTEM_PROMPT,
      context: 'No trades logged yet.',
      history: [],
      input: 'Read this screenshot. If you can see a trade, reply with a FILL: line.',
      imageDataUrl,
    })
    console.log('OK — provider accepted the image payload.')
    const fill = parseFillText(reply)
    console.log(`Reply starts: ${reply.slice(0, 120).replace(/\s+/g, ' ')}`)
    console.log(fill ? `FILL parsed → ${JSON.stringify(fill.patch)}` : 'No FILL line — nothing readable to fill (expected for a 1x1 pixel or a non-chart image).')
  } catch (e) {
    failures++
    console.error(`FAILED — ${e instanceof Error ? e.message : String(e)}`)
  }
}

console.log(failures === 0 ? '\nLIVE SMOKE OK ✅' : `\n${failures} PROVIDER(S) FAILED ❌`)
process.exit(failures === 0 ? 0 : 1)
