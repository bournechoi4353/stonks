"""Recommendation-history endpoints (Phase 6).

- GET /api/history?symbol=AAPL  -> past recommendations (newest first) with live performance
- GET /api/history/summary       -> aggregate track record (hit rate, avg return)

Performance is computed at read time by comparing the stored price to the current quote.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

from app.schemas import HistoryEntry, HistorySummary
from app.services import history, market_data

router = APIRouter(prefix="/api", tags=["history"])


def _loads(s: Optional[str]) -> list[str]:
    if not s:
        return []
    try:
        v = json.loads(s)
        return [str(x) for x in v] if isinstance(v, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _aligned(action: str, ret: Optional[float]) -> Optional[bool]:
    # Treat a negligible move (or a brand-new rec) as "too early to judge" rather than a miss.
    if ret is None or abs(ret) < 0.1:
        return None
    if action == "Buy":
        return ret > 0
    if action == "Sell":
        return ret < 0
    return None  # Hold isn't a directional call


def _days_ago(generated_at: str) -> Optional[int]:
    try:
        then = datetime.fromisoformat(generated_at)
        if then.tzinfo is None:
            then = then.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - then).days
    except (ValueError, TypeError):
        return None


async def _current_prices(symbols: set[str]) -> dict[str, Optional[float]]:
    sem = asyncio.Semaphore(6)

    async def one(sym: str) -> tuple[str, Optional[float]]:
        async with sem:
            try:
                quote = await asyncio.to_thread(market_data.get_quote, sym)
                return sym, quote.price
            except Exception:  # noqa: BLE001 — a missing price just means "can't evaluate"
                return sym, None

    return dict(await asyncio.gather(*(one(s) for s in symbols)))


def _entry(row: dict, current: Optional[float]) -> HistoryEntry:
    price = row["price"]
    ret = ((current - price) / price * 100) if (price and current) else None
    return HistoryEntry(
        id=row["id"],
        symbol=row["symbol"],
        name=row["name"],
        action=row["action"],
        conviction=row["conviction"],
        time_horizon=row["time_horizon"],
        news_sentiment=row["news_sentiment"],
        summary=row["summary"],
        reasoning=_loads(row["reasoning"]),
        risks=_loads(row["risks"]),
        price=price,
        signal_score=row["signal_score"],
        signal_bias=row["signal_bias"],
        model=row["model"],
        generated_at=row["generated_at"],
        current_price=current,
        return_pct=round(ret, 2) if ret is not None else None,
        aligned=_aligned(row["action"], ret),
        days_ago=_days_ago(row["generated_at"]),
    )


@router.get("/history", response_model=list[HistoryEntry])
async def get_history(
    symbol: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
) -> list[HistoryEntry]:
    rows = await asyncio.to_thread(history.fetch, symbol, limit)
    prices = await _current_prices({r["symbol"] for r in rows})
    return [_entry(r, prices.get(r["symbol"])) for r in rows]


@router.get("/history/summary", response_model=HistorySummary)
async def get_summary() -> HistorySummary:
    rows = await asyncio.to_thread(history.fetch, None, 1000)
    prices = await _current_prices({r["symbol"] for r in rows})

    by_action: dict[str, int] = {}
    returns: list[float] = []
    buy_returns: list[float] = []
    aligned = evaluated = 0

    for r in rows:
        by_action[r["action"]] = by_action.get(r["action"], 0) + 1
        price, current = r["price"], prices.get(r["symbol"])
        if price and current:
            ret = (current - price) / price * 100
            returns.append(ret)
            if r["action"] == "Buy":
                buy_returns.append(ret)
            al = _aligned(r["action"], ret)
            if al is not None:
                evaluated += 1
                aligned += 1 if al else 0

    return HistorySummary(
        total=len(rows),
        by_action=by_action,
        evaluated=evaluated,
        aligned=aligned,
        hit_rate=round(aligned / evaluated * 100, 1) if evaluated else None,
        avg_return_pct=round(sum(returns) / len(returns), 2) if returns else None,
        avg_buy_return_pct=round(sum(buy_returns) / len(buy_returns), 2) if buy_returns else None,
    )
