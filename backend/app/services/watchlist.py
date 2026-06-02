"""Watchlist persistence (Phase 4).

Single-user watchlist stored as a small JSON file under backend/data/. Seeded from
settings.default_watchlist on first use. Writes are atomic (temp file + os.replace) and a
corrupt file is backed up rather than silently destroyed. (SQLite arrives in Phase 6 for
rec history; the watchlist stays a simple file.)
"""
from __future__ import annotations

import json
import logging
import threading
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# backend/data/watchlist.json — resolved from this file so it's independent of cwd.
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_FILE = _DATA_DIR / "watchlist.json"
_TMP = _DATA_DIR / "watchlist.json.tmp"
_BAK = _DATA_DIR / "watchlist.json.bak"
_MAX_SYMBOLS = 50
_lock = threading.RLock()


def _clean(symbol: str) -> str:
    """Normalize a symbol; return '' if it isn't a plausible ticker."""
    s = (symbol or "").strip().upper()
    if not s or len(s) > 15 or not all(c.isalnum() or c in ".-^" for c in s):
        return ""
    return s


def _read_unlocked() -> list[str]:
    if _FILE.exists():
        try:
            raw = _FILE.read_text()
        except OSError:
            logger.warning("watchlist.json unreadable; using defaults without overwriting it")
            return settings.default_watchlist_list
        try:
            data = json.loads(raw)
            if not isinstance(data, list):
                raise ValueError("watchlist.json is not a JSON array")
            return [c for c in (_clean(s) for s in data) if c]
        except (json.JSONDecodeError, ValueError):
            # Preserve the corrupt file instead of silently destroying the user's list.
            try:
                _FILE.replace(_BAK)
                logger.warning("corrupt watchlist.json backed up to %s; re-seeding defaults", _BAK)
            except OSError:
                pass
    seed = settings.default_watchlist_list
    _write_unlocked(seed)
    return seed


def _write_unlocked(symbols: list[str]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _TMP.write_text(json.dumps(symbols, indent=2))
    _TMP.replace(_FILE)  # atomic on POSIX


def get_symbols() -> list[str]:
    with _lock:
        return _read_unlocked()


def add(symbol: str) -> list[str]:
    s = _clean(symbol)
    with _lock:
        symbols = _read_unlocked()
        if s and s not in symbols and len(symbols) < _MAX_SYMBOLS:
            symbols.append(s)
            _write_unlocked(symbols)
        return symbols


def remove(symbol: str) -> list[str]:
    s = _clean(symbol)
    with _lock:
        symbols = [x for x in _read_unlocked() if x != s]
        _write_unlocked(symbols)
        return symbols
