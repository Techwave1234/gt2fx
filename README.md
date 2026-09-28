# GT2FX Trading Journal 📓

[![test](https://github.com/Techwave1234/gt2fx/actions/workflows/test.yml/badge.svg)](https://github.com/Techwave1234/gt2fx/actions/workflows/test.yml)

▶ **Use it here:** https://techwave1234.github.io/gt2fx/

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

## Using it day-to-day (no coding needed)

Two double-click launchers are included for Windows:

- **`Start GT2FX.bat`** — serves the built app at `http://localhost:4173`. That address just means "served from your own computer" — nothing is online and no data leaves your machine. Use this normally; it always serves the latest build. Keep the console window open while you use the journal.
- **`Open GT2FX (no server).bat`** — opens `dist/index.html` directly in your browser: no server, no `localhost` address. Handy for a USB stick or another PC (the journal still works — data lives in that browser's `localStorage`).

### Why does `index.html` look blank if I open it?

The `index.html` in the project root is a **source template** — it points at `/src/main.tsx`, which only the Vite dev server can compile. A plain browser can't run it, so the page stays blank. That's expected.

The real, double-clickable app is **`dist/index.html`**: `npm run build` inlines *all* JavaScript and CSS into that single file (via `vite-plugin-singlefile`), so it works straight from disk. Rebuild after code changes so it stays up to date.

CI (`.github/workflows/test.yml`) runs the typecheck + test suite on every push.
