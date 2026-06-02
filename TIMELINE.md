# Stonks — Stock Recommender · Project Timeline

A personal web app that recommends **Buy / Sell / Hold** decisions for stocks, with
clear reasoning drawn from live company news, price history, and live(ish) market data.

> ⚠️ **It only recommends — it never buys or sells anything.** There is no brokerage
> connection. Nothing here is financial advice.

---

## Confirmed decisions

| Decision | Choice |
|---|---|
| **Recommendation engine** | **Hybrid** — quantitative signals + AI reasoning |
| **Market data source** | Yahoo Finance via `yfinance` (free; quotes ~15 min delayed) |
| **AI reasoning** | **Claude Agent SDK** using the Claude Code subscription (no API key / no credits) |
| **Users** | Single user / personal |
| **Stack** | FastAPI (Python) backend · React + TypeScript (Vite) frontend |
| **Storage** | SQLite (watchlist + recommendation history) |
| **Recommendation format** | Action (Buy/Sell/Hold) · Conviction 1–5 · Reasoning bullets · Key risks · Time horizon (short/long) |
| **Tickers** | Works for any ticker you type, plus a small default watchlist |
| **Track record (Phase 6)** | Kept in scope |

### How the data works (the "Yahoo Finance charts" question)
The app does **not** read chart images. It pulls the **raw numbers behind** Yahoo
Finance charts via `yfinance` (Yahoo's own data endpoints) — price history, fundamentals,
quotes, and news headlines — then computes its own indicators and renders its own charts.
`yfinance` is unofficial and free; fine for a personal tool. We can swap in a paid
real-time provider later without rebuilding the app.

### How the AI works (no credits needed)
The reasoning layer runs on the **Claude Agent SDK**, which authenticates with the
Claude Code subscription rather than a metered API key — so no Anthropic API credits are
consumed. The AI summarizes news sentiment and synthesizes the signals + news + price
context into the final recommendation and its written reasoning.

---

## Architecture (high level)

```
React + TS (Vite)  ──HTTP──>  FastAPI
  dashboard, charts,            │
  watchlist, rec cards          ├── data layer      → yfinance (prices, fundamentals, news)
                                ├── signals engine  → pandas / numpy (RSI, MACD, SMA/EMA, momentum…)
                                ├── AI layer        → Claude Agent SDK (news sentiment + synthesis)
                                └── storage         → SQLite (watchlist + recommendation history)
```

The recommendation pipeline for a ticker:
1. Fetch quote, price history, fundamentals, recent news (`yfinance`).
2. Compute quantitative signals → a structured "signal sheet".
3. AI summarizes news sentiment.
4. AI synthesizes signals + news + price context → structured recommendation.
5. Persist the recommendation; return it to the UI.

---

## Phases

| Phase | Goal | Key deliverables | Est. effort | Status |
|---|---|---|---|---|
| **0 — Foundations** | Scaffold that runs end-to-end | Repo structure, FastAPI server, React app, env config, health/"hello" call wired front→back | ~1 session | ✅ Done |
| **1 — Market data layer** | Pull everything from Yahoo | `yfinance` integration: quote, history, fundamentals, news; response caching | ~1 session | ✅ Done |
| **2 — Signals engine** | Raw data → quantitative signals | RSI, MACD, SMA/EMA crossovers, momentum, volume trend, 52-week range → signal sheet | ~1–2 sessions | ✅ Done |
| **3 — AI reasoning layer** | Claude reads news + signals | Claude Agent SDK adapter; news sentiment + structured rec (action, conviction, reasoning, risks, horizon); 30-min cache | ~1–2 sessions | ✅ Done |
| **4 — Recommendation API** | Clean endpoints | `/recommend/{ticker}` (combines 1–3) and `/watchlist` batch scoring | ~1 session | ✅ Done |
| **5 — Frontend dashboard** | The usable UI | Ticker search + watchlist, interactive price chart, news feed, recommendation card, disclaimer | ~2 sessions | ✅ Done |
| **6 — Recommendation history** | Track if picks were good | Store each rec + price; show how each call would've performed since | ~1 session | ✅ Done |
| **7 — Polish & run** | Pleasant + persistent | Loading/error states, refresh scheduling, run locally; optional deploy | ~1 session | 🚧 Next |

**Rough total:** ~9–11 focused build sessions. Phases 0–5 deliver a fully working
recommender; 6–7 are quality-of-life.

---

## Disclaimer
This software is for personal, educational use. It is **not financial advice**, not a
solicitation to buy or sell securities, and makes no guarantee of accuracy. You are
solely responsible for your own investment decisions.
