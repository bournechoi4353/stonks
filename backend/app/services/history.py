"""Recommendation history (Phase 6).

Persists every generated recommendation to a local SQLite database (stdlib sqlite3, no
extra dependency) so the engine builds a track record you can judge it by. Performance
(price-then vs price-now) is computed live at read time in the API layer, not stored.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import closing
from pathlib import Path

from app.schemas import Recommendation

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_DB = _DATA_DIR / "stonks.sqlite"
_write_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS recommendations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT NOT NULL,
    name          TEXT,
    action        TEXT NOT NULL,
    conviction    INTEGER,
    time_horizon  TEXT,
    news_sentiment TEXT,
    summary       TEXT,
    reasoning     TEXT,   -- JSON array
    risks         TEXT,   -- JSON array
    price         REAL,   -- price at the time of the recommendation
    signal_score  REAL,
    signal_bias   TEXT,
    model         TEXT,
    generated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_symbol ON recommendations(symbol);
"""


def _conn() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(_conn()) as conn:
        conn.executescript(_SCHEMA)
        conn.commit()


def record(rec: Recommendation) -> None:
    with _write_lock, closing(_conn()) as conn:
        conn.execute(
            """
            INSERT INTO recommendations
              (symbol, name, action, conviction, time_horizon, news_sentiment, summary,
               reasoning, risks, price, signal_score, signal_bias, model, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rec.symbol,
                rec.name,
                rec.action,
                rec.conviction,
                rec.time_horizon,
                rec.news_sentiment,
                rec.summary,
                json.dumps(rec.reasoning),
                json.dumps(rec.risks),
                rec.price,
                rec.signal_score,
                rec.signal_bias,
                rec.model,
                rec.generated_at,
            ),
        )
        conn.commit()


def fetch(symbol: str | None = None, limit: int = 200) -> list[dict]:
    query = "SELECT * FROM recommendations"
    params: list = []
    if symbol:
        query += " WHERE symbol = ?"
        params.append(symbol.strip().upper())
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with closing(_conn()) as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


# Ensure the table exists as soon as this module is imported.
init_db()
