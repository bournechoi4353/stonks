"""Recommendation + watchlist endpoints (Phase 4).

- GET  /api/recommend/{symbol}  -> full AI recommendation (cached 30 min; ?refresh=true)
- GET  /api/watchlist           -> quant-only score for each saved symbol (no AI)
- POST /api/watchlist           -> add a symbol, returns the rescored list
- DELETE /api/watchlist/{symbol}-> remove a symbol, returns the rescored list

Watchlist scoring deliberately avoids the AI layer (one Claude call per row would be
expensive); the full recommendation is fetched on demand when a stock is opened.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query

from app.schemas import Recommendation, SymbolIn, WatchlistItem
from app.services import market_data, recommender, signals, watchlist

router = APIRouter(prefix="/api", tags=["recommend"])


@router.get("/recommend/{symbol}", response_model=Recommendation)
async def recommend(symbol: str, refresh: bool = Query(False)) -> Recommendation:
    return await recommender.arecommend(symbol, force_refresh=refresh)


# Bound the concurrent yfinance fan-out so a large watchlist can't open N*2 threads at once.
_SCORE_CONCURRENCY = 6


async def _score(symbol: str, sem: asyncio.Semaphore) -> WatchlistItem:
    async with sem:
        try:
            sheet, quote = await asyncio.gather(
                asyncio.to_thread(signals.compute_signals, symbol),
                asyncio.to_thread(market_data.get_quote, symbol),
            )
            return WatchlistItem(
                symbol=symbol,
                name=quote.name,
                price=quote.price,
                change_percent=quote.change_percent,
                signal_score=sheet.score,
                bias=sheet.bias,
            )
        except market_data.TickerNotFoundError:
            return WatchlistItem(symbol=symbol, error="not found")
        except Exception:  # noqa: BLE001 — one bad symbol must not sink the whole list
            return WatchlistItem(symbol=symbol, error="data unavailable")


async def _score_many(symbols: list[str]) -> list[WatchlistItem]:
    if not symbols:
        return []
    sem = asyncio.Semaphore(_SCORE_CONCURRENCY)
    return list(await asyncio.gather(*(_score(s, sem) for s in symbols)))


@router.get("/watchlist", response_model=list[WatchlistItem])
async def get_watchlist() -> list[WatchlistItem]:
    return await _score_many(watchlist.get_symbols())


@router.post("/watchlist", response_model=list[WatchlistItem])
async def add_to_watchlist(payload: SymbolIn) -> list[WatchlistItem]:
    return await _score_many(watchlist.add(payload.symbol))


@router.delete("/watchlist/{symbol}", response_model=list[WatchlistItem])
async def remove_from_watchlist(symbol: str) -> list[WatchlistItem]:
    return await _score_many(watchlist.remove(symbol))
