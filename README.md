# GT2FX Trading Journal 📓

[![test](https://github.com/Techwave1234/gt2fx/actions/workflows/test.yml/badge.svg)](https://github.com/Techwave1234/gt2fx/actions/workflows/test.yml)

A dark, mobile-first trading journal web app with:

- **Paper-journal layout** — trade boxes with time, entry/SL/TP/exit, lot, risk, reward, R:R ratio, strategy, entry/exit reasons, lesson learned, emotion, followed-plan Yes/No, plus daily totals, checklist, "Today's Biggest Learning" and "Plan for Tomorrow"
- **Top-down (ICT/SMC) fields** — HTF/MTF/LTF bias with live alignment checks, POI type, entry model
- **Killzone picker** — Asia/London/NY/London-Close with automatic detection from your clock (NY-anchored, DST-correct)
- **57 instruments** — all 28 FX pairs, metals, indices, crypto, energies, each with correct pip math
- **Live calculations** — R:R, risk $ and %, reward $, suggested lot, realized P/L and R-multiple
- **Weekly Review** — week navigation, day-by-day P/L, per-setup / per-emotion / per-killzone win-rate tables, R-multiple histogram, auto coach notes
- **Backups** — one-tap JSON export, merge/replace import with validation, CSV for Excel/Sheets, Sunday auto-backup, stale-backup reminder, printable daily sheet
- **Floating AI coach** — offline mode (fills trades from text, critiques your journal, sizes positions, extracts lessons) plus optional real AI via OpenAI / Gemini / OpenRouter (key stored only in your browser)

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
