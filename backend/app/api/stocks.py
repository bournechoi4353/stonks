"""Stock market data endpoints (Phase 1)."""
from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas import Fundamentals, NewsItem, PriceHistory, Quote, SignalSheet, StockSnapshot
from app.services import market_data, signals

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

# Periods/intervals accepted by Yahoo Finance.
_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"}


@router.get("/{symbol}/quote", response_model=Quote)
def quote(symbol: str) -> Quote:
    return market_data.get_quote(symbol)


@router.get("/{symbol}/history", response_model=PriceHistory)
def history(
    symbol: str,
    period: str = Query("6mo", description="Yahoo period, e.g. 1mo, 6mo, 1y, max"),
    interval: str = Query("1d", description="Candle interval, e.g. 1d, 1h, 1wk"),
) -> PriceHistory:
    period = period if period in _PERIODS else "6mo"
    interval = interval if interval in _INTERVALS else "1d"
    return market_data.get_history(symbol, period=period, interval=interval)


@router.get("/{symbol}/fundamentals", response_model=Fundamentals)
def fundamentals(symbol: str) -> Fundamentals:
    return market_data.get_fundamentals(symbol)


@router.get("/{symbol}/news", response_model=list[NewsItem])
def news(symbol: str, limit: int = Query(10, ge=1, le=50)) -> list[NewsItem]:
    return market_data.get_news(symbol, limit=limit)


@router.get("/{symbol}/signals", response_model=SignalSheet)
def signal_sheet(symbol: str) -> SignalSheet:
    return signals.compute_signals(symbol)


@router.get("/{symbol}/snapshot", response_model=StockSnapshot)
def snapshot(symbol: str) -> StockSnapshot:
    return market_data.get_snapshot(symbol)
