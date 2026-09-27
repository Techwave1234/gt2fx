import { useEffect, useRef, useState } from 'react'
import type { AIMessage, AIProvider, ChecklistState, Trade } from '../types'
import { buildContext, callAI, offlineReply, parseFillText, SYSTEM_PROMPT } from '../lib/ai'
import { newTradeDefaults } from '../hooks/useJournal'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  trades: Trade[]
  checklist: ChecklistState
  aiConfig: { provider: AIProvider; apiKey: string; model: string }
  onConfigChange: (patch: Partial<{ provider: AIProvider; apiKey: string; model: string }>) => void
  history: AIMessage[]
  onHistoryChange: (h: AIMessage[]) => void
  /** Called when the coach parsed a trade so the form can be prefilled */
  onFill: (patch: Partial<Trade>) => void
}

const QUICK_PROMPTS = [
  'Fill: bought gold 2650 sl 2645 tp 2665 0.3 lots',
  'How am I doing?',
  'What are my mistakes?',
  'balance 5000, risk 1%',
  'I keep revenge trading',
]

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function AICoach({
  open, onOpenChange, trades, checklist, aiConfig,
  onConfigChange, history, onHistoryChange, onFill,
}: Props) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [history, open, busy])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || busy) return
    setErr(null)
    setInput('')
    setBusy(true)
    const userMsg: AIMessage = { id: uid(), role: 'user', content: msg, at: Date.now() }
    let reply = ''
    try {
      if (aiConfig.provider === 'offline' || !aiConfig.apiKey) {
        reply = offlineReply(msg, trades, checklist)
        await new Promise(r => setTimeout(r, 350)) // think-y pause
      } else {
        reply = await callAI({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          system: SYSTEM_PROMPT,
          context: buildContext(trades, checklist),
          history,
          input: msg,
        })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI request failed')
      reply = offlineReply(msg, trades, checklist) // graceful fallback
    } finally {
      setBusy(false)
    }
    const assistantMsg: AIMessage = { id: uid(), role: 'assistant', content: reply, at: Date.now() }
    onHistoryChange([...history, userMsg, assistantMsg])
  }

  if (!open) {
    return (
      <button
        type="button"
        className="ai-fab"
        onClick={() => onOpenChange(true)}
        aria-label="Open AI coach"
      >
        ✦
      </button>
    )
  }

  const fillFrom = (content: string): Partial<Trade> | null => {
    const parsed = parseFillText(content)
    return parsed ? { ...newTradeDefaults(), ...parsed.patch } : null
  }

  return (
    <div className="ai-panel">
      <header className="ai-head">
        <span className="ai-title">✦ AI Coach</span>
        <span className="ai-mode">
          {aiConfig.provider === 'offline' || !aiConfig.apiKey ? 'offline' : aiConfig.provider}
        </span>
        <button type="button" className="icon-btn" onClick={() => setSettingsOpen(s => !s)} aria-label="AI settings">⚙️</button>
        <button type="button" className="icon-btn" onClick={() => onOpenChange(false)} aria-label="Close coach">✕</button>
      </header>

      {settingsOpen && (
        <div className="ai-settings">
          <label className="field">
            <span>Provider</span>
            <select
              value={aiConfig.provider}
              onChange={e => onConfigChange({ provider: e.target.value as AIProvider })}
            >
              <option value="offline">Offline (no key)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </label>
          {aiConfig.provider !== 'offline' && (
            <>
              <label className="field">
                <span>API key</span>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={e => onConfigChange({ apiKey: e.target.value })}
                  placeholder="sk-… (stays in your browser)"
                />
              </label>
              <label className="field">
                <span>Model (optional)</span>
                <input
                  value={aiConfig.model}
                  onChange={e => onConfigChange({ model: e.target.value })}
                  placeholder="e.g. gpt-4o-mini / gemini-2.0-flash"
                />
              </label>
              <small>Your key is stored only in localStorage on this device and sent only to the provider you chose.</small>
            </>
          )}
        </div>
      )}

      <div className="ai-list" ref={listRef}>
        {history.length === 0 && (
          <div className="ai-welcome">
            <p><b>GT2FX AI Coach</b></p>
            <p>I can fill trades from plain text, critique your entries, check risk, and extract lessons.</p>
            <div className="quick-prompts">
              {QUICK_PROMPTS.map(q => (
                <button key={q} type="button" className="chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
            <p className="sub">Offline mode is on — connect a key in ⚙️ for deeper answers.</p>
          </div>
        )}
        {history.map(m => {
          const fill = m.role === 'assistant' ? fillFrom(m.content) : null
          return (
            <div key={m.id} className={`ai-msg ${m.role === 'user' ? 'me' : 'coach'}`}>
              <pre>{m.content}</pre>
              {fill && (
                <button type="button" className="btn mini primary" onClick={() => onFill(fill)}>
                  Apply to form →
                </button>
              )}
            </div>
          )
        })}
        {busy && <div className="ai-msg coach"><pre>…thinking</pre></div>}
        {err && <div className="ai-msg coach error"><pre>{err} — fell back to offline reply.</pre></div>}
      </div>

      <footer className="ai-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Type a trade or question…"
        />
        <button type="button" className="btn primary" onClick={() => send()} disabled={busy}>Send</button>
      </footer>
    </div>
  )
}
