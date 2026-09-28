import { useState } from 'react'
import type { Trade } from '../types'
import { EMOTION_OPTIONS } from '../types'
import { calcTrade, fmtMoney, fmtNum, fmtR, resultColor } from '../lib/calc'
import { killzoneById } from '../lib/killzones'

interface Props {
  trade: Trade
  index: number
  onUpdate: (id: string, patch: Partial<Trade>) => void
  onDelete: (id: string) => void
}

function priceDigits(pair: string): number {
  return pair.includes('XAU') || pair.includes('JPY') ? 2 : 5
}

export default function TradeCard({ trade: t, index, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [pickingEmotion, setPickingEmotion] = useState(false)
  const c = calcTrade(t)
  const d = priceDigits(t.pair)

  /** Close as a loss with one tapped emotion merged into any existing tags */
  function closeLossWith(emotion?: string) {
    const emotions = emotion && !t.emotions.includes(emotion) ? [...t.emotions, emotion] : t.emotions
    onUpdate(t.id, { result: 'loss', emotions })
    setPickingEmotion(false)
  }

  return (
    <article className={`card trade-card ${open ? 'expanded' : ''}`}>
      <button type="button" className="card-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={`dir-badge ${t.direction === 'long' ? 'buy' : 'sell'}`}>{t.direction === 'long' ? '▲' : '▼'}</span>
        <span className="pair">{t.pair}</span>
        <span className="trade-no">TRADE {index}</span>
        <span className="spacer" />
        <span className="pnl" style={{ color: resultColor(t.result) }}>
          {c.pnl !== null ? fmtMoney(c.pnl) : c.rr !== null ? `${fmtNum(c.rr, 1)}R plan` : '—'}
        </span>
        <span className={`chev ${open ? 'up' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="card-body">
          <div className="calc-strip">
            <div><small>Time</small><strong>{t.time}</strong></div>
            <div><small>Session</small><strong>{t.session}</strong></div>
            <div><small>Killzone</small><strong>{killzoneById(t.killzone)?.label ?? '—'}</strong></div>
            <div><small>Result</small><strong style={{ color: resultColor(t.result) }}>{t.result}</strong></div>
            <div><small>Confidence</small><strong>{'●'.repeat(t.confidence)}{'○'.repeat(5 - t.confidence)}</strong></div>
          </div>

          <div className="calc-strip">
            <div><small>Entry price</small><strong>{fmtNum(t.entry, d)}</strong></div>
            <div><small>Stop loss</small><strong>{fmtNum(t.stopLoss, d)}</strong></div>
            <div><small>Take profit</small><strong>{fmtNum(t.takeProfit, d)}</strong></div>
            <div><small>Exit price</small><strong>{fmtNum(t.exit, d)}</strong></div>
          </div>

          <div className="calc-strip">
            <div><small>Lot</small><strong>{fmtNum(t.lots, 2)}</strong></div>
            <div><small>Risk</small><strong>{fmtMoney(c.riskAmount)}</strong></div>
            <div><small>Reward</small><strong>{fmtMoney(c.plannedReward)}</strong></div>
            <div><small>R:R ratio</small><strong>{c.rr !== null ? `1:${fmtNum(c.rr, 2)}` : '—'}</strong></div>
            <div><small>R multiple</small><strong>{fmtR(c.rMultiple)}</strong></div>
          </div>

          {(t.biasHTF || t.biasMTF || t.biasLTF) && (
            <div className="bias-row">
              <span className={`bias-pill ${t.biasHTF || 'none'}`}>HTF {t.biasHTF || '—'}</span>
              <span className={`bias-pill ${t.biasMTF || 'none'}`}>MTF {t.biasMTF || '—'}</span>
              <span className={`bias-pill ${t.biasLTF || 'none'}`}>LTF {t.biasLTF || '—'}</span>
              {t.poi && <span className="bias-pill poi">{t.poi}</span>}
              {t.entryModel && <span className="bias-pill model">{t.entryModel}</span>}
            </div>
          )}

          {t.setup && <p><b>Strategy:</b> {t.setup}</p>}
          {t.entryReason && <p><b>Entry reason:</b> {t.entryReason}</p>}
          {t.exitReason && <p><b>Exit reason:</b> {t.exitReason}</p>}
          {t.lessons && <p className="lesson"><b>Lesson learned:</b> {t.lessons}</p>}
          {t.emotions.length > 0 && (
            <p><b>Emotion:</b> {t.emotions.join(', ')}</p>
          )}
          {t.notes && <p><b>Notes:</b> {t.notes}</p>}

          <p className="followed-line">
            <b>Followed plan:</b>{' '}
            <span className={`followed-badge ${t.followedPlan ? 'yes' : 'no'}`}>
              {t.followedPlan ? 'YES' : 'NO'}
            </span>
            {' · '}Risk {fmtNum(t.riskPercent, 1)}%{t.balance ? ` · Balance ${fmtMoney(t.balance).replace('+', '')}` : ''}
          </p>
          {t.screenshotUrl && (
            t.screenshotUrl.startsWith('data:') ? (
              <img className="shot-inline" src={t.screenshotUrl} alt="Trade screenshot" />
            ) : (
              <p><a href={t.screenshotUrl} target="_blank" rel="noreferrer">📸 View screenshot</a></p>
            )
          )}

          {t.result === 'open' && !pickingEmotion && (
            <div className="quick-close">
              <small>Close as:</small>
              <button type="button" className="btn mini win" onClick={() => onUpdate(t.id, { result: 'win' })}>Win</button>
              <button type="button" className="btn mini loss" onClick={() => setPickingEmotion(true)}>Loss</button>
              <button type="button" className="btn mini be" onClick={() => onUpdate(t.id, { result: 'breakeven' })}>BE</button>
            </div>
          )}

          {t.result === 'open' && pickingEmotion && (
            <div className="loss-emo">
              <small>Close as <b>LOSS</b> — why did it lose? One tap:</small>
              <div className="chips">
                {EMOTION_OPTIONS.map(e => (
                  <button key={e} type="button" className="chip" onClick={() => closeLossWith(e)}>{e}</button>
                ))}
              </div>
              <div className="loss-emo-actions">
                <button type="button" className="btn mini ghost" onClick={() => setPickingEmotion(false)}>Cancel</button>
                <button type="button" className="btn mini loss" onClick={() => closeLossWith()}>Tag later</button>
              </div>
            </div>
          )}

          <div className="card-actions">
            <button type="button" className="btn mini ghost" onClick={() => onDelete(t.id)}>Delete</button>
          </div>
        </div>
      )}
    </article>
  )
}
