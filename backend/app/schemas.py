"""Pydantic response models for the market data layer."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class Quote(BaseModel):
    symbol: str
    name: Optional[str] = None
    price: Optional[float] = None
    previous_close: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    year_high: Optional[float] = None
    year_low: Optional[float] = None
    volume: Optional[int] = None
    market_cap: Optional[float] = None
    currency: Optional[str] = None
    exchange: Optional[str] = None
    as_of: Optional[str] = None  # ISO timestamp when fetched (data may be ~15 min delayed)


class Candle(BaseModel):
    date: str  # ISO date (daily) or ISO datetime (intraday)
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[int] = None


class PriceHistory(BaseModel):
    symbol: str
    period: str
    interval: str
    candles: list[Candle]


class Fundamentals(BaseModel):
    symbol: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    trailing_pe: Optional[float] = None
    forward_pe: Optional[float] = None
    market_cap: Optional[float] = None
    dividend_yield: Optional[float] = None  # as reported by Yahoo (percent, e.g. 0.35 = 0.35%)
    beta: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    currency: Optional[str] = None
    exchange: Optional[str] = None
    website: Optional[str] = None
    summary: Optional[str] = None


class NewsItem(BaseModel):
    title: str
    publisher: Optional[str] = None
    link: Optional[str] = None
    published_at: Optional[str] = None  # ISO timestamp
    summary: Optional[str] = None


class StockSnapshot(BaseModel):
    symbol: str
    quote: Quote
    fundamentals: Optional[Fundamentals] = None
    news: list[NewsItem] = []
    history: Optional[PriceHistory] = None


class IndicatorSignal(BaseModel):
    name: str
    value: Optional[float] = None
    # "bullish" | "bearish" | "neutral" | "insufficient"
    signal: str
    detail: str
    weight: float = 1.0  # contribution to the composite score


class SignalSheet(BaseModel):
    symbol: str
    as_of: str
    price: Optional[float] = None  # most recent close used for indicator comparisons
    score: float  # composite net bullishness in [-1, 1]
    bias: str  # "bullish" | "bearish" | "neutral"
    bullish_count: int = 0
    bearish_count: int = 0
    neutral_count: int = 0
    signals: list[IndicatorSignal] = []
    metrics: dict[str, Optional[float]] = {}  # raw indicator values for AI/UI


class Recommendation(BaseModel):
    symbol: str
    name: Optional[str] = None
    action: str  # "Buy" | "Sell" | "Hold"
    conviction: int  # 1 (weak) .. 5 (strong)
    time_horizon: str  # "short" | "long"
    news_sentiment: str  # "positive" | "negative" | "mixed" | "neutral"
    summary: str
    reasoning: list[str] = []
    risks: list[str] = []
    # Grounding/context carried through for transparency in the UI.
    price: Optional[float] = None
    signal_score: Optional[float] = None
    signal_bias: Optional[str] = None
    model: Optional[str] = None
    generated_at: str
    disclaimer: str = "Not financial advice — for personal, educational use only."


class WatchlistItem(BaseModel):
    """Lightweight, quant-only scoring for a watchlist row (no AI call)."""
    symbol: str
    name: Optional[str] = None
    price: Optional[float] = None
    change_percent: Optional[float] = None
    signal_score: Optional[float] = None
    bias: Optional[str] = None
    error: Optional[str] = None  # set if this symbol could not be scored


class SymbolIn(BaseModel):
    # Validated at the edge: rejects junk/oversized input with a 422 before it is persisted.
    symbol: str = Field(min_length=1, max_length=15, pattern=r"^[A-Za-z0-9.\-\^]+$")


class HistoryEntry(BaseModel):
    id: int
    symbol: str
    name: Optional[str] = None
    action: str
    conviction: Optional[int] = None
    time_horizon: Optional[str] = None
    news_sentiment: Optional[str] = None
    summary: Optional[str] = None
    reasoning: list[str] = []
    risks: list[str] = []
    price: Optional[float] = None  # price when the recommendation was made
    signal_score: Optional[float] = None
    signal_bias: Optional[str] = None
    model: Optional[str] = None
    generated_at: str
    # Computed live at read time:
    current_price: Optional[float] = None
    return_pct: Optional[float] = None  # (current - price) / price * 100
    aligned: Optional[bool] = None  # did price move the way the call implied? (None for Hold)
    days_ago: Optional[int] = None


class HistorySummary(BaseModel):
    total: int
    by_action: dict[str, int] = {}
    evaluated: int  # Buy/Sell calls that have a current price to judge
    aligned: int  # of evaluated, how many moved the recommended way
    hit_rate: Optional[float] = None  # aligned / evaluated * 100
    avg_return_pct: Optional[float] = None  # across all recs with a current price
    avg_buy_return_pct: Optional[float] = None  # across Buy calls with a current price
