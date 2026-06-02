"""Market data layer — wraps yfinance (Yahoo Finance) with normalization + TTL caching.

All network access goes through here. Results are cached in-memory with short TTLs to
respect Yahoo's informal rate limits and keep the UI snappy. yfinance is unofficial and
free; quotes are typically ~15 minutes delayed.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Callable

import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from app.schemas import Candle, Fundamentals, NewsItem, PriceHistory, Quote, StockSnapshot


# --- errors -------------------------------------------------------------------

class MarketDataError(Exception):
    """Upstream data source failed (network/parse). Maps to HTTP 502."""


class TickerNotFoundError(Exception):
    """Symbol is unknown or has no data. Maps to HTTP 404."""

    def __init__(self, symbol: str) -> None:
        super().__init__(f"No data found for symbol '{symbol}'")
        self.symbol = symbol


# --- caching ------------------------------------------------------------------

_lock = threading.Lock()
_caches: dict[str, TTLCache] = {
    "quote": TTLCache(maxsize=512, ttl=60),          # 1 min
    "history": TTLCache(maxsize=512, ttl=300),        # 5 min
    "fundamentals": TTLCache(maxsize=512, ttl=3600),  # 1 hour
    "news": TTLCache(maxsize=512, ttl=600),           # 10 min
}


def _cached(bucket: str, key: Any, producer: Callable[[], Any]) -> Any:
    """Return cached value or compute it. Network call runs outside the lock."""
    cache = _caches[bucket]
    with _lock:
        if key in cache:
            return cache[key]
    value = producer()
    with _lock:
        cache[key] = value
    return value


def clear_cache() -> None:
    with _lock:
        for cache in _caches.values():
            cache.clear()


# --- helpers ------------------------------------------------------------------

def _normalize(symbol: str) -> str:
    s = (symbol or "").strip().upper()
    if not s or len(s) > 15:
        raise TickerNotFoundError(symbol)
    return s


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _r(x: Any, ndigits: int = 2) -> float | None:
    """Round to drop float32 noise; None-safe."""
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return round(float(x), ndigits)
    except (TypeError, ValueError):
        return None


def _int(x: Any) -> int | None:
    """None/NaN-safe int conversion (yfinance can hand back NaN for volume)."""
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def _fi_get(fast_info: Any, key: str) -> Any:
    try:
        return fast_info[key]
    except Exception:
        return None


def _fmt_index(ts: Any, interval: str) -> str:
    if interval.endswith(("d", "wk", "mo")):
        return ts.date().isoformat()
    return ts.isoformat()


# --- public API ---------------------------------------------------------------

def get_quote(symbol: str) -> Quote:
    symbol = _normalize(symbol)

    def produce() -> Quote:
        ticker = yf.Ticker(symbol)
        try:
            fi = ticker.fast_info
            last = _fi_get(fi, "lastPrice")
            prev = _fi_get(fi, "regularMarketPreviousClose") or _fi_get(fi, "previousClose")
        except Exception as exc:  # noqa: BLE001
            raise MarketDataError(str(exc)) from exc

        if last is None and prev is None:
            raise TickerNotFoundError(symbol)

        change = (last - prev) if (last is not None and prev is not None) else None
        change_pct = (change / prev * 100) if (change is not None and prev) else None

        return Quote(
            symbol=symbol,
            price=_r(last),
            previous_close=_r(prev),
            change=_r(change),
            change_percent=_r(change_pct),
            open=_r(_fi_get(fi, "open")),
            day_high=_r(_fi_get(fi, "dayHigh")),
            day_low=_r(_fi_get(fi, "dayLow")),
            year_high=_r(_fi_get(fi, "yearHigh")),
            year_low=_r(_fi_get(fi, "yearLow")),
            volume=_int(_fi_get(fi, "lastVolume")),
            market_cap=_r(_fi_get(fi, "marketCap"), 0),
            currency=_fi_get(fi, "currency"),
            exchange=_fi_get(fi, "exchange"),
            as_of=_now_iso(),
        )

    return _cached("quote", symbol, produce)


def get_history(symbol: str, period: str = "6mo", interval: str = "1d") -> PriceHistory:
    symbol = _normalize(symbol)
    key = (symbol, period, interval)

    def produce() -> PriceHistory:
        ticker = yf.Ticker(symbol)
        try:
            df = ticker.history(period=period, interval=interval, auto_adjust=True)
        except Exception as exc:  # noqa: BLE001
            raise MarketDataError(str(exc)) from exc

        if df is None or df.empty:
            raise TickerNotFoundError(symbol)

        candles: list[Candle] = []
        for idx, row in df.iterrows():
            vol = row.get("Volume")
            candles.append(
                Candle(
                    date=_fmt_index(idx, interval),
                    open=_r(row.get("Open")),
                    high=_r(row.get("High")),
                    low=_r(row.get("Low")),
                    close=_r(row.get("Close")),
                    volume=int(vol) if vol is not None and not pd.isna(vol) else None,
                )
            )
        return PriceHistory(symbol=symbol, period=period, interval=interval, candles=candles)

    return _cached("history", key, produce)


def get_fundamentals(symbol: str) -> Fundamentals:
    symbol = _normalize(symbol)

    def produce() -> Fundamentals:
        ticker = yf.Ticker(symbol)
        try:
            info = ticker.info or {}
        except Exception as exc:  # noqa: BLE001
            raise MarketDataError(str(exc)) from exc

        name = info.get("longName") or info.get("shortName")
        if not name and not info.get("marketCap"):
            raise TickerNotFoundError(symbol)

        return Fundamentals(
            symbol=symbol,
            name=name,
            sector=info.get("sector"),
            industry=info.get("industry"),
            trailing_pe=_r(info.get("trailingPE"), 2),
            forward_pe=_r(info.get("forwardPE"), 2),
            market_cap=_r(info.get("marketCap"), 0),
            dividend_yield=_r(info.get("dividendYield"), 4),
            beta=_r(info.get("beta"), 3),
            fifty_two_week_high=_r(info.get("fiftyTwoWeekHigh")),
            fifty_two_week_low=_r(info.get("fiftyTwoWeekLow")),
            currency=info.get("currency"),
            exchange=info.get("exchange"),
            website=info.get("website"),
            summary=info.get("longBusinessSummary"),
        )

    return _cached("fundamentals", symbol, produce)


def get_news(symbol: str, limit: int = 10) -> list[NewsItem]:
    symbol = _normalize(symbol)

    def produce() -> list[NewsItem]:
        ticker = yf.Ticker(symbol)
        try:
            raw = ticker.news or []
        except Exception as exc:  # noqa: BLE001
            raise MarketDataError(str(exc)) from exc
        return _normalize_news(raw)

    items = _cached("news", symbol, produce)
    return items[:limit]


def _normalize_news(raw: list[dict]) -> list[NewsItem]:
    items: list[NewsItem] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        content = entry.get("content")
        if isinstance(content, dict):  # current yfinance shape (nested under "content")
            title = content.get("title")
            summary = content.get("summary") or content.get("description")
            published = content.get("pubDate") or content.get("displayTime")
            provider = (content.get("provider") or {}).get("displayName")
            url = (content.get("canonicalUrl") or {}).get("url") or (
                content.get("clickThroughUrl") or {}
            ).get("url")
        else:  # legacy flat shape
            title = entry.get("title")
            summary = entry.get("summary")
            published = entry.get("providerPublishTime")
            if isinstance(published, (int, float)):
                published = datetime.fromtimestamp(published, tz=timezone.utc).isoformat()
            provider = entry.get("publisher")
            url = entry.get("link")

        if not title:
            continue
        items.append(
            NewsItem(title=title, publisher=provider, link=url, published_at=published, summary=summary or None)
        )
    return items


def get_snapshot(symbol: str) -> StockSnapshot:
    """Bundle quote + fundamentals + recent news + 6mo daily history in one call.

    The quote validates the symbol; the other parts degrade gracefully so a single
    failing source (e.g. news) doesn't sink the whole snapshot.
    """
    symbol = _normalize(symbol)
    quote = get_quote(symbol)  # raises TickerNotFoundError for unknown symbols

    fundamentals = None
    try:
        fundamentals = get_fundamentals(symbol)
    except (MarketDataError, TickerNotFoundError):
        pass

    news: list[NewsItem] = []
    try:
        news = get_news(symbol, limit=8)
    except MarketDataError:
        pass

    history = None
    try:
        history = get_history(symbol, period="6mo", interval="1d")
    except (MarketDataError, TickerNotFoundError):
        pass

    # Don't mutate the cached Quote in place — return a copy with the name filled in.
    if fundamentals and fundamentals.name and not quote.name:
        quote = quote.model_copy(update={"name": fundamentals.name})

    return StockSnapshot(symbol=symbol, quote=quote, fundamentals=fundamentals, news=news, history=history)
