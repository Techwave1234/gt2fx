# GT2FX Trading Journal 📓

[![test](https://github.com/YOUR-USERNAME/gt2fx/actions/workflows/test.yml/badge.svg)](https://github.com/YOUR-USERNAME/gt2fx/actions/workflows/test.yml)

> 🏷️ After pushing to GitHub, replace both `YOUR-USERNAME` occurrences above with your GitHub username to activate the badge.

A dark, mobile-first trading journal web app with:

- **Full trade fields** — date, time, session, pair, direction, setup, entry/SL/TP, exit, lots, risk %, balance, confidence, emotions, notes, lessons, screenshot link
- **Live calculations** — R:R, risk in $ and %, suggested lot size, realized P/L in pips/$ and R-multiple
- **Collapsible trade cards** with filters (today / date / all, result, search)
- **Daily summary + psychology checklist** (followed plan, respected risk, no revenge, no overtrading, journaled, stopped at limit)
- **Stats** — win rate, net P/L, net R, expectancy, streaks, by-pair breakdown, 14-day P/L chart
- **Floating AI coach** — offline mode (fills trades from text, critiques your journal, sizes positions, extracts lessons) plus optional real AI via OpenAI-compatible / Gemini / OpenRouter APIs (key stored only in your browser)

All data stays in your browser via `localStorage` — nothing is uploaded.

## Run it

```bash
npm install
npm run dev      # dev server (prints a local URL)
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
npm test         # Sunday-backup + backup round-trip suites (64 checks)
```

CI (`.github/workflows/test.yml`) runs the typecheck + test suite on every push.
