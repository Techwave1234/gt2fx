import { useEffect, useMemo, useState } from 'react'
import type { Bias, Trade } from '../types'
import { BIAS_OPTIONS, EMOTION_OPTIONS, MODEL_OPTIONS, POI_OPTIONS, SESSION_OPTIONS } from '../types'
import { calcTrade, fmtMoney, fmtNum, fmtR } from '../lib/calc'
import { newTradeDefaults } from '../hooks/useJournal'
import { KILLZONES, detectKillzone, killzoneById } from '../lib/killzones'
import { PAIR_SYMBOLS } from '../lib/pairs'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (t: Trade) => void
  /** Partial trade to prefill (e.g. from AI "fill it") */
  prefill?: Partial<Trade> | null
}

function NumField(props: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step?: string
  placeholder?: string
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={props.step ?? 'any'}
        placeholder={props.placeholder ?? '—'}
        value={props.value ?? ''}
        onChange={e => {
          const v = e.target.value
          props.onChange(v === '' ? null : Number(v))
        }}
      />
    </label>
  )
}

export default function TradeForm({ open, onClose, onSave, prefill }: Props) {
  const [t, setT] = useState<Trade>(() => ({ ...newTradeDefaults(), ...(prefill ?? {}) }))

  // Re-initialize when prefill changes while closed→open
  const prefillKey = JSON.stringify(prefill ?? null)
  const [seenKey, setSeenKey] = useState(prefillKey)
  if (open && prefillKey !== seenKey) {
    setSeenKey(prefillKey)
    setT({ ...newTradeDefaults(), ...(prefill ?? {}) })
  }

  const set = <K extends keyof Trade>(key: K, value: Trade[K]) => setT(prev => ({ ...prev, [key]: value }))

  const calc = useMemo(() => calcTrade(t), [t])

  // Auto-detect the killzone once when the form opens (only if not already set)
  useEffect(() => {
    if (!open) return
    setT(prev => {
      if (prev.killzone) return prev
      const d = detectKillzone(prev.date, prev.time)
      return d ? { ...prev, killzone: d.kz.id, session: d.kz.session } : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Live hint: which killzone does the entered time fall in?
  const detected = useMemo(() => detectKillzone(t.date, t.time), [t.date, t.time])
  const selectedKz = killzoneById(t.killzone)

  // Top-down alignment: are HTF/MTF/LTF all pointing the same way as the trade?
  const aligned = useMemo<'ok' | 'partial' | 'counter' | 'none'>(() => {
    if (!t.biasHTF || !t.biasMTF || !t.biasLTF) return 'none'
    const dirBull = t.direction === 'long'
    const htfAgrees = t.biasHTF === (dirBull ? 'bullish' : 'bearish')
    const allAgree = [t.biasHTF, t.biasMTF, t.biasLTF].every(b => b === (dirBull ? 'bullish' : 'bearish'))
    if (allAgree) return 'ok'
    if (htfAgrees) return 'partial'
    return 'counter'
  }, [t.biasHTF, t.biasMTF, t.biasLTF, t.direction])

  if (!open) return null

  const toggleEmotion = (e: string) =>
    set('emotions', t.emotions.includes(e) ? t.emotions.filter(x => x !== e) : [...t.emotions, e])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal trade-form"
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          onSave(t)
          onClose()
        }}
      >
        <header>
          <h2>New trade</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="grid2">
          <label className="field">
            <span>Date</span>
            <input type="date" value={t.date} onChange={e => set('date', e.target.value)} required />
          </label>
          <label className="field">
            <span>Time</span>
            <input type="time" value={t.time} onChange={e => set('time', e.target.value)} />
          </label>
          <label className="field">
            <span>Pair</span>
            <input list="pairs" value={t.pair} onChange={e => set('pair', e.target.value.toUpperCase())} placeholder="XAUUSD" required />
            <datalist id="pairs">
              {PAIR_SYMBOLS.map(p => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <div className="field">
            <span>Direction</span>
            <div className="seg">
              <button type="button" className={t.direction === 'long' ? 'active buy' : ''} onClick={() => set('direction', 'long')}>▲ Long</button>
              <button type="button" className={t.direction === 'short' ? 'active sell' : ''} onClick={() => set('direction', 'short')}>▼ Short</button>
            </div>
          </div>
          <label className="field">
            <span>Session</span>
            <select value={t.session} onChange={e => set('session', e.target.value)}>
              {SESSION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Strategy</span>
            <input value={t.setup} onChange={e => set('setup', e.target.value)} placeholder="e.g. Gold PD array long" />
          </label>
        </div>

        <div className="kz-block">
          <div className="topdown-head">
            <span>Killzone</span>
            {detected && <em className="kz-live">🕐 {detected.kz.label} · {detected.nyTime} NY right now</em>}
          </div>
          <div className="chips">
            <button type="button" className={t.killzone === '' ? 'chip active' : 'chip'} onClick={() => set('killzone', '')}>None</button>
            {KILLZONES.map(kz => (
              <button
                key={kz.id}
                type="button"
                className={t.killzone === kz.id ? 'chip active' : 'chip'}
                title={`${kz.start}–${kz.end} NY · ${kz.note}`}
                onClick={() => { set('killzone', kz.id); set('session', kz.session) }}
              >
                {kz.label}
              </button>
            ))}
          </div>
          {selectedKz && <p className="kz-note">💡 {selectedKz.note}</p>}
          {!detected && !selectedKz && t.killzone === '' && (
            <p className="kz-note muted">Outside known killzones — double-check you're not forcing a trade.</p>
          )}
        </div>

        <div className="topdown">
          <div className="topdown-head">
            <span>Top-down analysis</span>
            {aligned === 'ok' && <em className="align ok">✓ aligned</em>}
            {aligned === 'partial' && <em className="align partial">partial alignment</em>}
            {aligned === 'counter' && <em className="align counter">⚠ counter-trend</em>}
          </div>
          <div className="grid3">
            <label className="field">
              <span>HTF bias (D1/H4)</span>
              <select value={t.biasHTF} onChange={e => set('biasHTF', e.target.value as Bias)}>
                <option value="">—</option>
                {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="field">
              <span>MTF bias (H1/M15)</span>
              <select value={t.biasMTF} onChange={e => set('biasMTF', e.target.value as Bias)}>
                <option value="">—</option>
                {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="field">
              <span>LTF bias (M5/M1)</span>
              <select value={t.biasLTF} onChange={e => set('biasLTF', e.target.value as Bias)}>
                <option value="">—</option>
                {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </div>
          <div className="grid2">
            <label className="field">
              <span>POI type</span>
              <input list="poi-list" value={t.poi} onChange={e => set('poi', e.target.value)} placeholder="OB, FVG, breaker…" />
              <datalist id="poi-list">
                {POI_OPTIONS.map(p => <option key={p} value={p} />)}
              </datalist>
            </label>
            <label className="field">
              <span>Entry model</span>
              <input list="model-list" value={t.entryModel} onChange={e => set('entryModel', e.target.value)} placeholder="MSS, BOS retest…" />
              <datalist id="model-list">
                {MODEL_OPTIONS.map(m => <option key={m} value={m} />)}
              </datalist>
            </label>
          </div>
        </div>

        <div className="grid3">
          <NumField label="Entry price" value={t.entry} onChange={v => set('entry', v)} />
          <NumField label="Stop loss" value={t.stopLoss} onChange={v => set('stopLoss', v)} />
          <NumField label="Take profit" value={t.takeProfit} onChange={v => set('takeProfit', v)} />
          <NumField label="Exit price" value={t.exit} onChange={v => set('exit', v)} />
          <NumField label="Lot" value={t.lots} onChange={v => set('lots', v)} step="0.01" />
          <NumField label="Risk %" value={t.riskPercent} onChange={v => set('riskPercent', v)} step="0.1" />
          <NumField label="Balance $" value={t.balance} onChange={v => set('balance', v)} step="1" />
          <div className="field">
            <span>Result</span>
            <select value={t.result} onChange={e => set('result', e.target.value as Trade['result'])}>
              <option value="open">Open</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
            </select>
          </div>
          <div className="field">
            <span>Confidence: {t.confidence}/5</span>
            <input type="range" min={1} max={5} value={t.confidence} onChange={e => set('confidence', Number(e.target.value))} />
          </div>
        </div>

        {/* Live calculations */}
        <div className="calc-strip">
          <div><small>Risk $</small><strong>{fmtMoney(calc.riskAmount)}</strong></div>
          <div><small>Reward $</small><strong>{fmtMoney(calc.plannedReward)}</strong></div>
          <div><small>R:R ratio</small><strong>{calc.rr !== null ? `1:${fmtNum(calc.rr, 2)}` : '—'}</strong></div>
          <div><small>Suggested lot</small><strong>{fmtNum(calc.suggestedLots, 2)}</strong></div>
          <div><small>P/L</small><strong style={{ color: (calc.pnl ?? 0) > 0 ? 'var(--green)' : (calc.pnl ?? 0) < 0 ? 'var(--red)' : undefined }}>{fmtMoney(calc.pnl)}</strong></div>
          <div><small>R multiple</small><strong>{fmtR(calc.rMultiple)}</strong></div>
        </div>
        {calc.rr !== null && calc.rr < 1.5 && (
          <p className="warn">⚠️ R:R below 1.5 — weak asymmetry for a retail strategy.</p>
        )}
        {t.stopLoss === null && t.entry !== null && (
          <p className="warn">⚠️ No stop loss set — define risk before entering.</p>
        )}
        {(t.riskPercent ?? 0) > 2 && (
          <p className="warn">⚠️ Risk above 2% of the account — aggressive.</p>
        )}
        {aligned === 'counter' && (
          <p className="warn">⚠️ Entry goes against your HTF bias — counter-trend trades need extra confluence.</p>
        )}
        {aligned === 'partial' && (
          <p className="warn">⚠️ Timeframes not fully aligned — wait for MTF/LTF to confirm the HTF direction.</p>
        )}
        {t.poi !== '' && t.entryModel === '' && (
          <p className="warn">💡 POI marked but no entry model — how exactly do you trigger?</p>
        )}

        <div className="field">
          <span>Emotions during trade</span>
          <div className="chips">
            {EMOTION_OPTIONS.map(e => (
              <button key={e} type="button" className={t.emotions.includes(e) ? 'chip active' : 'chip'} onClick={() => toggleEmotion(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={t.notes} onChange={e => set('notes', e.target.value)} placeholder="What did you see? Why did you enter?" />
        </label>
        <label className="field">
          <span>Lesson learned</span>
          <textarea rows={2} value={t.lessons} onChange={e => set('lessons', e.target.value)} placeholder="What will you do differently?" />
        </label>
        <label className="field">
          <span>Entry reason</span>
          <textarea rows={2} value={t.entryReason} onChange={e => set('entryReason', e.target.value)} placeholder="Why did you take this trade?" />
        </label>
        <label className="field">
          <span>Exit reason</span>
          <textarea rows={2} value={t.exitReason} onChange={e => set('exitReason', e.target.value)} placeholder="Why did you close it?" />
        </label>
        <div className="field">
          <span>Followed plan?</span>
          <div className="seg">
            <button type="button" className={t.followedPlan ? 'active buy' : ''} onClick={() => set('followedPlan', true)}>Yes</button>
            <button type="button" className={!t.followedPlan ? 'active sell' : ''} onClick={() => set('followedPlan', false)}>No</button>
          </div>
        </div>
        <label className="field">
          <span>Screenshot URL (optional)</span>
          <input value={t.screenshotUrl} onChange={e => set('screenshotUrl', e.target.value)} placeholder="https://..." />
        </label>

        <footer>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save trade</button>
        </footer>
      </form>
    </div>
  )
}
