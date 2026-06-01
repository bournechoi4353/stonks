# Stonks — Personal Stock Recommender

A personal web app that recommends **Buy / Sell / Hold** for stocks, with reasoning drawn
from live company news, price history, and market data.

> ⚠️ **Recommender only.** It never buys or sells anything and is **not financial advice**.

See [TIMELINE.md](TIMELINE.md) for the full plan, decisions, and phase status.

## Stack
- **Backend:** FastAPI (Python 3.12)
- **Frontend:** React + TypeScript (Vite)
- **Data:** Yahoo Finance via `yfinance`
- **Signals:** pandas / pandas-ta
- **AI reasoning:** Claude Agent SDK (uses the Claude Code subscription — no API key needed)
- **Storage:** SQLite

## Project layout
```
stonks/
├── backend/      FastAPI app
│   └── app/
│       ├── main.py        app entrypoint + CORS
│       ├── config.py      settings (env-driven)
│       └── api/routes.py  API routes
└── frontend/     React + Vite app
    └── src/
        ├── App.tsx        UI
        └── api/client.ts  backend client
```

## Run it (development)

**Backend** (from `backend/`):
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend runs at http://localhost:8000 (docs at `/docs`).

**Frontend** (from `frontend/`):
```bash
npm install
npm run dev
```
Frontend runs at http://localhost:5173 and proxies `/api/*` to the backend.
