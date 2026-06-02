"""Recommender (Phase 3) — the hybrid reasoning layer.

Gathers the quantitative signal sheet, recent news, and price/valuation context for a
ticker, then asks Claude (via the subscription-backed adapter) to synthesize a single
structured Buy/Sell/Hold recommendation with reasoning and risks.

One Claude call per recommendation (news sentiment + synthesis combined) to conserve
subscription usage, plus a 30-minute cache.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timezone
from typing import Optional

from cachetools import TTLCache

from app.config import settings
from app.schemas import Fundamentals, NewsItem, Quote, Recommendation, SignalSheet
from app.services import history, llm, market_data, signals

logger = logging.getLogger(__name__)

_VALID_ACTIONS = {"buy": "Buy", "sell": "Sell", "hold": "Hold"}

_rec_cache: TTLCache = TTLCache(maxsize=256, ttl=1800)  # 30 min
_rec_lock = threading.Lock()

SYSTEM_PROMPT = (
    "You are a disciplined equity research analyst. You produce a single, structured "
    "Buy/Sell/Hold recommendation for ONE stock, reasoning ONLY from the quantitative "
    "technical signals, valuation, price action, and recent news provided to you. Do not "
    "invent facts or rely on outside knowledge of events beyond the supplied data. Weigh "
    "bullish and bearish evidence explicitly and stay balanced. Each reasoning bullet must "
    "cite a specific signal (e.g. 'MACD histogram positive', 'RSI 72 overbought') or a "
    "specific news item. Conviction reflects how strongly the combined evidence supports "
    "the action: 1 = weak/conflicting, 5 = strong/aligned. You are not a financial advisor "
    "and this is not financial advice. Respond with ONLY a single valid JSON object — no "
    "markdown, no commentary."
)


def _fmt(value: Optional[float], suffix: str = "") -> str:
    return f"{value}{suffix}" if value is not None else "n/a"


def _build_prompt(
    symbol: str,
    quote: Quote,
    fundamentals: Optional[Fundamentals],
    sheet: SignalSheet,
    news: list[NewsItem],
) -> str:
    name = (fundamentals.name if fundamentals else None) or quote.name or symbol
    lines: list[str] = []
    lines.append(f"# Stock: {symbol} ({name})")
    if fundamentals:
        lines.append(f"Sector: {_fmt(fundamentals.sector)} | Industry: {_fmt(fundamentals.industry)}")

    lines.append("\n## Price & valuation")
    lines.append(f"- Current price: {_fmt(quote.price)} {quote.currency or ''} (change {_fmt(quote.change_percent, '%')} today)")
    lines.append(f"- 52-week range: {_fmt(quote.year_low)} – {_fmt(quote.year_high)}")
    lines.append(f"- Market cap: {_fmt(quote.market_cap)}")
    if fundamentals:
        lines.append(f"- Trailing P/E: {_fmt(fundamentals.trailing_pe)} | Forward P/E: {_fmt(fundamentals.forward_pe)}")
        lines.append(f"- Beta: {_fmt(fundamentals.beta)} | Dividend yield: {_fmt(fundamentals.dividend_yield, '%')}")

    lines.append("\n## Quantitative signals")
    lines.append(f"Composite score: {sheet.score} (range -1 bearish .. +1 bullish), overall bias: {sheet.bias}")
    lines.append(f"Counts — bullish {sheet.bullish_count}, bearish {sheet.bearish_count}, neutral {sheet.neutral_count}")
    for s in sheet.signals:
        if s.signal == "insufficient":
            continue
        lines.append(f"- [{s.signal.upper()}] {s.name}: {s.detail}")

    lines.append("\n## Recent company news")
    if news:
        for i, item in enumerate(news, 1):
            when = f" ({item.published_at})" if item.published_at else ""
            src = f" — {item.publisher}" if item.publisher else ""
            summary = f" :: {item.summary}" if item.summary else ""
            lines.append(f"{i}. {item.title}{src}{when}{summary}")
    else:
        lines.append("(no recent news available)")

    lines.append(
        "\n## Task\n"
        "Synthesize the above into one recommendation. Respond with ONLY this JSON object:\n"
        "{\n"
        '  "action": "Buy" | "Sell" | "Hold",\n'
        '  "conviction": <integer 1-5>,\n'
        '  "time_horizon": "short" | "long",\n'
        '  "news_sentiment": "positive" | "negative" | "mixed" | "neutral",\n'
        '  "summary": "<1-2 sentence plain-English recommendation>",\n'
        '  "reasoning": ["<3-6 bullets, each citing a specific signal or news item>"],\n'
        '  "risks": ["<2-4 bullets on what could make this call wrong>"]\n'
        "}"
    )
    return "\n".join(lines)


def _coerce(symbol: str, data: dict, sheet: SignalSheet, quote: Quote, name: Optional[str]) -> Recommendation:
    action = _VALID_ACTIONS.get(str(data.get("action", "")).strip().lower(), "Hold")

    try:
        conviction = int(data.get("conviction", 3))
    except (TypeError, ValueError):
        conviction = 3
    conviction = max(1, min(5, conviction))

    horizon_raw = str(data.get("time_horizon", "long")).strip().lower()
    time_horizon = "short" if "short" in horizon_raw else "long"

    sentiment_raw = str(data.get("news_sentiment", "neutral")).strip().lower()
    news_sentiment = sentiment_raw if sentiment_raw in {"positive", "negative", "mixed", "neutral"} else "neutral"

    def _as_list(v) -> list[str]:
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str) and v.strip():
            return [v.strip()]
        return []

    return Recommendation(
        symbol=symbol,
        name=name,
        action=action,
        conviction=conviction,
        time_horizon=time_horizon,
        news_sentiment=news_sentiment,
        summary=str(data.get("summary", "")).strip() or f"{action} ({sheet.bias} signals).",
        reasoning=_as_list(data.get("reasoning")),
        risks=_as_list(data.get("risks")),
        price=quote.price,
        signal_score=sheet.score,
        signal_bias=sheet.bias,
        model=settings.ai_model,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


async def arecommend(symbol: str, force_refresh: bool = False) -> Recommendation:
    symbol = market_data._normalize(symbol)

    if not force_refresh:
        with _rec_lock:
            cached = _rec_cache.get(symbol)
        if cached is not None:
            return cached

    # Gather context off the event loop (yfinance is blocking I/O).
    sheet = await asyncio.to_thread(signals.compute_signals, symbol)  # validates symbol -> 404
    quote = await asyncio.to_thread(market_data.get_quote, symbol)

    fundamentals = None
    try:
        fundamentals = await asyncio.to_thread(market_data.get_fundamentals, symbol)
    except (market_data.MarketDataError, market_data.TickerNotFoundError):
        pass

    news: list[NewsItem] = []
    try:
        news = await asyncio.to_thread(market_data.get_news, symbol, 8)
    except market_data.MarketDataError:
        pass

    prompt = _build_prompt(symbol, quote, fundamentals, sheet, news)
    raw = await llm.acomplete(prompt, system=SYSTEM_PROMPT)
    data = llm.extract_json(raw)

    name = (fundamentals.name if fundamentals else None) or quote.name
    rec = _coerce(symbol, data, sheet, quote, name)

    try:
        history.record(rec)  # build the track record
    except Exception:  # noqa: BLE001 — persistence must never break a recommendation
        logger.warning("failed to record recommendation for %s", symbol, exc_info=True)

    with _rec_lock:
        _rec_cache[symbol] = rec
    return rec
