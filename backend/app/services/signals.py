"""Signals engine (Phase 2).

Turns raw price/volume history into a structured "signal sheet": a set of classic
technical indicators, each interpreted as bullish / bearish / neutral, plus a single
weighted composite score in [-1, 1]. Indicators are computed directly with pandas/numpy
(no pandas-ta, which is incompatible with numpy 2.x).

This is the quantitative half of the hybrid recommendation; Phase 3's AI layer reads
this sheet (and the news) to produce the final call and its reasoning.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import pandas as pd

from app.schemas import IndicatorSignal, SignalSheet
from app.services import market_data

BULLISH = "bullish"
BEARISH = "bearish"
NEUTRAL = "neutral"
INSUFFICIENT = "insufficient"

_DIR = {BULLISH: 1.0, BEARISH: -1.0, NEUTRAL: 0.0}


# --- indicator math -----------------------------------------------------------

def _last(series: pd.Series) -> Optional[float]:
    if series is None or len(series) == 0:
        return None
    val = series.iloc[-1]
    return float(val) if pd.notna(val) else None


def _sma(closes: pd.Series, n: int) -> Optional[float]:
    if len(closes) < n:
        return None
    return _last(closes.rolling(n).mean())


def _ema(closes: pd.Series, n: int) -> Optional[float]:
    if len(closes) < n:
        return None
    return _last(closes.ewm(span=n, adjust=False).mean())


def _rsi(closes: pd.Series, period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    delta = closes.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    # Wilder's smoothing == EWM with alpha = 1/period.
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return _last(rsi)


def _macd(closes: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """Return (macd_line, signal_line, histogram) latest values, or (None, None, None)."""
    if len(closes) < slow + signal:
        return None, None, None
    ema_fast = closes.ewm(span=fast, adjust=False).mean()
    ema_slow = closes.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return _last(macd_line), _last(signal_line), _last(hist)


def _roc(closes: pd.Series, period: int = 20) -> Optional[float]:
    if len(closes) <= period:
        return None
    prev = closes.iloc[-1 - period]
    if prev == 0 or pd.isna(prev):
        return None
    return (closes.iloc[-1] / prev - 1) * 100


def _r(x: Optional[float], n: int = 2) -> Optional[float]:
    return round(x, n) if x is not None else None


# --- signal sheet -------------------------------------------------------------

def compute_signals(symbol: str, period: str = "1y", interval: str = "1d") -> SignalSheet:
    symbol = market_data._normalize(symbol)
    history = market_data.get_history(symbol, period=period, interval=interval)

    closes = pd.Series([c.close for c in history.candles], dtype="float64").dropna().reset_index(drop=True)
    volumes = pd.Series(
        [c.volume if c.volume is not None else float("nan") for c in history.candles], dtype="float64"
    )

    signals: list[IndicatorSignal] = []

    def add(name: str, value: Optional[float], sig: str, detail: str, weight: float) -> None:
        signals.append(IndicatorSignal(name=name, value=_r(value, 4), signal=sig, detail=detail, weight=weight))

    n = len(closes)
    last = float(closes.iloc[-1]) if n else None

    # Pre-compute shared indicators.
    sma20 = _sma(closes, 20)
    sma50 = _sma(closes, 50)
    sma200 = _sma(closes, 200)
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    rsi = _rsi(closes, 14)
    macd_line, macd_signal, macd_hist = _macd(closes)
    roc20 = _roc(closes, 20)

    # 1) Long-term trend: 50/200 SMA cross (golden vs death cross).
    if sma50 is not None and sma200 is not None:
        bull = sma50 > sma200
        add(
            "Trend (SMA50 vs SMA200)",
            sma50 - sma200,
            BULLISH if bull else BEARISH,
            f"SMA50 {sma50:.2f} {'>' if bull else '<'} SMA200 {sma200:.2f} — {'golden cross / uptrend' if bull else 'death cross / downtrend'}",
            2.0,
        )
    else:
        add("Trend (SMA50 vs SMA200)", None, INSUFFICIENT, "Need 200+ days of history", 2.0)

    # 2) Price vs SMA200 (long-term).
    if last is not None and sma200 is not None:
        bull = last > sma200
        add("Price vs SMA200", last - sma200, BULLISH if bull else BEARISH,
            f"Price {last:.2f} {'above' if bull else 'below'} SMA200 {sma200:.2f}", 1.0)
    else:
        add("Price vs SMA200", None, INSUFFICIENT, "Need 200+ days of history", 1.0)

    # 3) Price vs SMA50 (medium-term).
    if last is not None and sma50 is not None:
        bull = last > sma50
        add("Price vs SMA50", last - sma50, BULLISH if bull else BEARISH,
            f"Price {last:.2f} {'above' if bull else 'below'} SMA50 {sma50:.2f}", 1.0)
    else:
        add("Price vs SMA50", None, INSUFFICIENT, "Need 50+ days of history", 1.0)

    # 4) EMA12 vs EMA26 (short-term momentum cross).
    if ema12 is not None and ema26 is not None:
        bull = ema12 > ema26
        add("EMA12 vs EMA26", ema12 - ema26, BULLISH if bull else BEARISH,
            f"EMA12 {ema12:.2f} {'>' if bull else '<'} EMA26 {ema26:.2f}", 1.0)
    else:
        add("EMA12 vs EMA26", None, INSUFFICIENT, "Need 26+ days of history", 1.0)

    # 5) RSI(14): <30 oversold (bullish), >70 overbought (bearish).
    if rsi is not None:
        if rsi < 30:
            sig, note = BULLISH, "oversold — potential bounce"
        elif rsi > 70:
            sig, note = BEARISH, "overbought — potential pullback"
        else:
            sig, note = NEUTRAL, "neutral zone"
        add("RSI(14)", rsi, sig, f"RSI {rsi:.1f} — {note}", 1.0)
    else:
        add("RSI(14)", None, INSUFFICIENT, "Need 15+ days of history", 1.0)

    # 6) MACD histogram: >0 bullish, <0 bearish.
    if macd_hist is not None:
        bull = macd_hist > 0
        add("MACD", macd_hist, BULLISH if bull else BEARISH,
            f"MACD {macd_line:.2f} vs signal {macd_signal:.2f}; histogram {macd_hist:+.2f} ({'bullish' if bull else 'bearish'})", 1.5)
    else:
        add("MACD", None, INSUFFICIENT, "Need 35+ days of history", 1.5)

    # 7) Momentum: 20-day rate of change.
    if roc20 is not None:
        if roc20 > 2:
            sig = BULLISH
        elif roc20 < -2:
            sig = BEARISH
        else:
            sig = NEUTRAL
        add("Momentum (20d ROC)", roc20, sig, f"20-day change {roc20:+.1f}%", 1.0)
    else:
        add("Momentum (20d ROC)", None, INSUFFICIENT, "Need 21+ days of history", 1.0)

    # 8) Volume trend: recent 10d avg vs 50d avg, directed by short-term price move.
    vol_change = None
    if volumes.notna().sum() >= 50:
        recent = volumes.tail(10).mean()
        base = volumes.tail(50).mean()
        if base and not pd.isna(base) and base > 0:
            vol_change = (recent / base - 1) * 100
    roc5 = _roc(closes, 5)
    if vol_change is not None and roc5 is not None:
        elevated = vol_change > 10
        if elevated and roc5 > 0:
            sig, note = BULLISH, "rising volume confirming an up-move"
        elif elevated and roc5 < 0:
            sig, note = BEARISH, "rising volume confirming a down-move"
        else:
            sig, note = NEUTRAL, "volume not confirming a clear move"
        add("Volume trend", vol_change, sig, f"10d vs 50d avg volume {vol_change:+.0f}% — {note}", 0.5)
    else:
        add("Volume trend", None, INSUFFICIENT, "Need 50+ days of volume", 0.5)

    # 9) 52-week range position.
    high_52w = low_52w = range_pos = None
    if n >= 2:
        window = closes.tail(252)
        high_52w = float(window.max())
        low_52w = float(window.min())
        if high_52w > low_52w:
            range_pos = (last - low_52w) / (high_52w - low_52w)
            if range_pos > 0.8:
                sig, note = BULLISH, "near 52-week high (strength)"
            elif range_pos < 0.2:
                sig, note = BEARISH, "near 52-week low (weakness)"
            else:
                sig, note = NEUTRAL, "mid-range"
            add("52-week range position", range_pos * 100, sig,
                f"At {range_pos * 100:.0f}% of 52-week range — {note}", 0.5)
        else:
            add("52-week range position", None, INSUFFICIENT, "Flat range", 0.5)
    else:
        add("52-week range position", None, INSUFFICIENT, "Need price history", 0.5)

    # --- composite score ------------------------------------------------------
    num = den = 0.0
    bullish_count = bearish_count = neutral_count = 0
    for s in signals:
        if s.signal == INSUFFICIENT:
            continue
        num += _DIR[s.signal] * s.weight
        den += s.weight
        if s.signal == BULLISH:
            bullish_count += 1
        elif s.signal == BEARISH:
            bearish_count += 1
        else:
            neutral_count += 1

    score = round(num / den, 3) if den else 0.0
    bias = BULLISH if score > 0.2 else BEARISH if score < -0.2 else NEUTRAL

    metrics: dict[str, Optional[float]] = {
        "sma20": _r(sma20), "sma50": _r(sma50), "sma200": _r(sma200),
        "ema12": _r(ema12), "ema26": _r(ema26),
        "rsi14": _r(rsi, 1),
        "macd": _r(macd_line), "macd_signal": _r(macd_signal), "macd_hist": _r(macd_hist),
        "roc20": _r(roc20, 2), "vol_change_pct": _r(vol_change, 1),
        "high_52w": _r(high_52w), "low_52w": _r(low_52w),
        "range_position_pct": _r(range_pos * 100, 1) if range_pos is not None else None,
    }

    return SignalSheet(
        symbol=symbol,
        as_of=datetime.now(timezone.utc).isoformat(),
        price=_r(last),
        score=score,
        bias=bias,
        bullish_count=bullish_count,
        bearish_count=bearish_count,
        neutral_count=neutral_count,
        signals=signals,
        metrics=metrics,
    )
