# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal, single-user **stock recommender** web app. It produces Buy/Sell/Hold
recommendations with written reasoning by combining quantitative technical signals, recent
company news, and price/valuation context. It is a **recommender only** — there is no
brokerage integration and it never places trades.

`TIMELINE.md` is the source of truth for the project plan, the confirmed design decisions,
and per-phase status. Read it before starting new work.

## Commands

Backend (Python 3.12, FastAPI) — run from `backend/`:
```bash
python3.12 -m venv .venv && source .venv/bin/activate   # .venv already exists; created with Homebrew python3.12
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000               # API at :8000, interactive docs at /docs
```
From the repo root instead, pass `--app-dir backend`:
`backend/.venv/bin/uvicorn app.main:app --app-dir backend --port 8000`

Frontend (React + TS, Vite) — run from `frontend/`:
```bash
npm install
npm run dev        # http://localhost:5173 ; proxies /api/* to the backend on :8000
npm run build      # tsc typecheck + vite production build (use this as the frontend "lint"/typecheck)
```

There is **no automated test suite yet**. Verify changes by:
- Hitting the API: `curl http://localhost:8000/api/stocks/AAPL/snapshot` (or use `/docs`).
- Running service code directly — note you **must** set `PYTHONPATH` because ad-hoc scripts
  don't add the backend dir to the path:
  ```bash
  PYTHONPATH=backend backend/.venv/bin/python your_script.py
  ```

## Architecture

The recommendation is a **hybrid**: a deterministic quantitative half + an AI synthesis half.

Backend layering (`backend/app/`): `api/` (thin FastAPI routers) → `services/` (all logic) →
`schemas.py` (Pydantic models, the contract shared by services and routes).

Request flow for a recommendation:
`market_data` (raw Yahoo data) → `signals` (indicators → signal sheet) + news → `recommender`
builds a grounded prompt → `llm` (one Claude call) → validated `Recommendation`.

Key modules and how they relate:
- **`services/market_data.py`** — the single network boundary. Wraps `yfinance`, normalizes
  Yahoo's messy shapes (e.g. the nested `content` news format, float32 price noise), and
  caches everything in per-bucket `TTLCache`s (quote 60s, history 5m, fundamentals 1h, news
  10m). Raises `TickerNotFoundError` (→404) and `MarketDataError` (→502). `_normalize()` is
  reused by other services to validate/upper-case symbols.
- **`services/signals.py`** — pure pandas/numpy. Computes RSI, MACD, SMA/EMA, momentum,
  volume trend, 52-week position; each becomes an `IndicatorSignal` (bullish/bearish/neutral/
  **insufficient**). Indicators lacking enough history are marked `insufficient` and excluded
  from the weighted **composite score** in `[-1, 1]` (>0.2 bullish, <-0.2 bearish). Depends on
  `market_data.get_history`.
- **`services/llm.py`** — the Claude adapter (Claude Agent SDK). One-shot, tools disabled,
  `setting_sources=[]` (ignores the repo's own CLAUDE.md/settings/MCP), `bypassPermissions`.
  Exposes `acomplete()` + `extract_json()`.
- **`services/recommender.py`** — orchestrates the above into one `Recommendation`. Makes
  **exactly one** Claude call per rec (news sentiment + synthesis combined) and caches results
  30 min — both to conserve subscription usage. Gathers blocking yfinance data via
  `asyncio.to_thread` so the event loop isn't blocked. `_coerce()` defends against bad model
  output (clamps action/conviction/horizon).
- **`services/history.py` + `api/history.py`** — SQLite track record (stdlib `sqlite3`, DB at
  `backend/data/stonks.sqlite`). `recommender` records every *fresh* rec; the API recomputes
  performance (stored price-then vs. live quote-now) at read time — nothing performance-related
  is stored.
- **`main.py`** — registers CORS, includes routers, and maps the service exception types to
  HTTP status codes. New service error types must be wired here to surface correctly.
- **Frontend** — `src/api/client.ts` (typed, mirrors the Pydantic schemas) calls `/api/*`; Vite
  proxies to the backend (see `vite.config.ts`). `App.tsx` = sidebar (search + watchlist) +
  `StockView`, which loads snapshot/signals fast and the AI recommendation separately (slow).
  Per-symbol fetches use a monotonic request-id guard (`StockView`) / cancellation (`useAsync`)
  so a stale response can't overwrite a newer symbol.

## Project-specific gotchas

- **Python must be 3.12** (the Claude Agent SDK needs ≥3.10). The system Python is 3.9 — don't
  use it; use `backend/.venv` (Homebrew `python3.12`).
- **No `pandas-ta`.** It imports the removed `numpy.NaN` and breaks on numpy 2.x (installed).
  All indicators are hand-computed in `signals.py` — keep it that way.
- **AI auth = Claude Code subscription, no API key.** `llm.py` shells out (via the SDK) to the
  installed, logged-in `claude` CLI. Do **not** add `ANTHROPIC_API_KEY` handling — verified
  working without it. The model is **Opus 4.8** (`config.ai_model = "claude-opus-4-8"`). To control
  usage, recommendations are **opt-in** in the UI (no auto-fetch) and cached 30 min server-side; the
  watchlist/grid/chart features use no model at all.
- **yfinance is unofficial/free** and ~15-min delayed; it can occasionally break or rate-limit.
  That's why everything is cached and failures degrade gracefully (e.g. `get_snapshot` returns
  partial data if news fails).
- Backend dev port **8000**, frontend **5173**. If a run leaves an orphaned server, free the
  port with `lsof -ti tcp:8000 | xargs kill -9`.
