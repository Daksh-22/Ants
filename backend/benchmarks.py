"""
Live Indian index benchmarks — trailing 1-year returns for Nifty 50, Sensex
and Nifty Midcap 150.

Why this exists: the frontend hardcoded
    BENCHMARKS = { nifty50: 8.5, sensex: 7.2, microCap: 12.3 }
and rendered "You vs Nifty 50" as the hero of the insights screen. Those
numbers were not merely stale, they had the wrong sign — the Nifty's actual
trailing year was negative while the app congratulated every user for beating
a fabricated +8.5%. A comparison you invent is worse than no comparison.

Same shape as quotes.py: one cached, deadline-bounded fetch; degrade to
`available: False` rather than to a made-up number, so the UI can say it
doesn't know instead of lying.
"""

from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# Index returns move slowly; an hour-old number is honest, a fabricated one never is.
TTL_SECONDS = 60 * 60
# A partial read is served but expires quickly, so the missing index is retried
# on the next request rather than an hour later.
PARTIAL_TTL_SECONDS = 90
FETCH_DEADLINE_SECONDS = float(os.environ.get("BENCHMARK_DEADLINE_SECONDS", "10"))

# key -> (display label, Yahoo symbol)
INDEXES: dict[str, tuple[str, str]] = {
    "nifty50": ("Nifty 50", "^NSEI"),
    "sensex": ("Sensex", "^BSESN"),
    "midCap": ("Nifty Midcap 150", "^CRSMID"),
}

_cache: dict[str, Any] | None = None
_cached_at: float = 0.0


def _fetch_one(key: str) -> tuple[str, dict[str, Any]] | None:
    """Trailing 1-year total return for one index, or None if unavailable."""
    try:
        import yfinance as yf
    except ImportError:
        return None

    label, symbol = INDEXES[key]
    try:
        hist = yf.Ticker(symbol).history(period="1y")
        # A handful of bars means a bad symbol or a throttled response, not a
        # real year — refuse rather than compute a garbage return.
        if hist is None or len(hist) < 20:
            return None
        first = float(hist["Close"].iloc[0])
        last = float(hist["Close"].iloc[-1])
        if first <= 0:
            return None
        return key, {
            "label": label,
            "symbol": symbol,
            "returnPct": round((last / first - 1) * 100, 2),
            "asOf": str(hist.index[-1].date()),
        }
    except Exception:
        return None


def get_benchmarks(force: bool = False) -> dict[str, Any]:
    """{available, indexes: {key: {label, symbol, returnPct, asOf}}, note}.

    `available` is False when nothing could be resolved. Callers must not
    substitute a placeholder return in that case — show "unavailable" instead.
    """
    global _cache, _cached_at

    now = time.time()
    if _cache is not None and not force and (now - _cached_at) < TTL_SECONDS:
        return _cache

    resolved: dict[str, Any] = {}
    keys = list(INDEXES)
    try:
        with ThreadPoolExecutor(max_workers=len(keys)) as pool:
            futures = [pool.submit(_fetch_one, k) for k in keys]
            for fut in as_completed(futures, timeout=FETCH_DEADLINE_SECONDS):
                try:
                    result = fut.result(timeout=1)
                except Exception:
                    result = None
                if result:
                    resolved[result[0]] = result[1]
    except Exception:
        pass  # deadline hit — keep whatever landed

    payload = {
        "available": bool(resolved),
        "indexes": resolved,
        "note": None if resolved else "Live index data is unavailable right now.",
    }

    # Only cache a COMPLETE read for the full hour. Caching any non-empty
    # result meant a partial fetch — say Sensex resolved but Nifty timed out —
    # was pinned as authoritative with available: True, so the Nifty row simply
    # vanished from the comparison for an hour instead of being retried. A
    # partial read is still worth serving, just not worth remembering for long.
    if len(resolved) == len(INDEXES):
        _cache, _cached_at = payload, now
    elif resolved:
        _cache, _cached_at = payload, now - TTL_SECONDS + PARTIAL_TTL_SECONDS
    return payload
