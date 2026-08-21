"""
Live quote resolution — turns any Indian ticker into (name, sector, price).

Why this exists: engine.KNOWN_STOCKS is a hand-curated table of ~37 tickers.
Anything outside it priced flat at the user's buy price (a fake 0% return). This
module resolves quotes live from Yahoo Finance so the analysis is honest about
any stock, then degrades to an explicitly unpriced state when the network won't
play — never to a stale price dressed up as a current one.

Resolution order per ticker:
  1. live      — fetched from Yahoo (NSE `.NS`, then BSE `.BO`)
  2. unpriced  — flat at the user's avg; return shows 0% and we say so

There is no stale-snapshot tier. KNOWN_STOCKS once carried hardcoded prices used
as a middle step; they drifted ~2 years out of date and were reported to the UI
as real valuations, so only its names and sectors remain.

Design notes:
  * Two caches with different TTLs: prices go stale in minutes, names and
    sectors effectively never change.
  * Fetches run concurrently (yfinance is blocking I/O) under a total
    deadline, so one slow ticker can't hang the whole request.
  * Curated sectors WIN over Yahoo's for known tickers — Yahoo calls TCS
    "Technology"; Indian investors call it IT. Yahoo only fills the long tail.
"""

from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Iterable

from engine import KNOWN_STOCKS, _norm

# yfinance is chatty on failures; we handle them ourselves
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

PRICE_TTL_SECONDS = 15 * 60          # prices: refresh every 15 min
PROFILE_TTL_SECONDS = 30 * 24 * 3600  # name/sector: effectively permanent
FETCH_DEADLINE_SECONDS = float(os.environ.get("QUOTE_DEADLINE_SECONDS", "8"))
MAX_WORKERS = 8

# set LIVE_PRICES=0 to force the static table (useful for offline/dev)
LIVE_PRICES_ENABLED = os.environ.get("LIVE_PRICES", "1") != "0"

_price_cache: dict[str, tuple[float, float]] = {}          # ticker -> (price, fetched_at)
_profile_cache: dict[str, tuple[str, str, float]] = {}     # ticker -> (name, sector, fetched_at)


@dataclass
class Quote:
    ticker: str
    name: str
    sector: str
    price: float
    #  live | reference | unpriced
    source: str


# ─── Yahoo (GICS-ish) sector → the India-flavoured names the app speaks ──────

_SECTOR_MAP = {
    "technology": "IT",
    "financial services": "Banking",   # refined by industry below
    "energy": "Energy",
    "utilities": "Power",
    "healthcare": "Pharma",
    "consumer defensive": "FMCG",
    "consumer cyclical": "Consumer",
    "communication services": "Telecom",
    "basic materials": "Materials",
    "industrials": "Industrials",
    "real estate": "Real Estate",
}

# Financial Services is too broad to be useful — split it on industry
_FINANCE_INDUSTRY_MAP = {
    "banks": "Banking",
    "credit services": "NBFC",
    "capital markets": "Financial",
    "insurance": "Insurance",
    "asset management": "Financial",
    "financial data": "Financial",
    "mortgage finance": "NBFC",
}


def _map_sector(yf_sector: str | None, yf_industry: str | None) -> str:
    sector = (yf_sector or "").strip().lower()
    industry = (yf_industry or "").strip().lower()

    if sector == "financial services":
        for needle, mapped in _FINANCE_INDUSTRY_MAP.items():
            if needle in industry:
                return mapped
        return "Financial"

    return _SECTOR_MAP.get(sector, "Other")


# ─── single-ticker fetch ─────────────────────────────────────────────────────

def _fetch_one(key: str) -> Quote | None:
    """Resolve one normalized ticker from Yahoo. None when it can't be priced."""
    try:
        import yfinance as yf
    except ImportError:
        return None

    curated = KNOWN_STOCKS.get(key)
    now = time.time()

    # cached price still fresh? then we may not need the network at all
    cached_price = _price_cache.get(key)
    price: float | None = None
    if cached_price and (now - cached_price[1]) < PRICE_TTL_SECONDS:
        price = cached_price[0]

    cached_profile = _profile_cache.get(key)
    name: str | None = None
    sector: str | None = None
    if cached_profile and (now - cached_profile[2]) < PROFILE_TTL_SECONDS:
        name, sector = cached_profile[0], cached_profile[1]
    elif curated:
        name, sector = curated[0], curated[1]

    if price is not None and name and sector:
        return Quote(key, name, sector, price, "live")

    # need the network. Try NSE first (more reliable), then BSE.
    for suffix in (".NS", ".BO"):
        symbol = f"{key}{suffix}"
        try:
            tk = yf.Ticker(symbol, session=None)

            if price is None:
                try:
                    # try fast_info first (most reliable)
                    p = tk.fast_info.get("lastPrice") or tk.fast_info.get("last_price")
                    if p is None:
                        # fallback to regular info
                        info = tk.info or {}
                        p = info.get("currentPrice") or info.get("regularMarketPrice")

                    if p and float(p) > 0:
                        price = float(p)
                        _price_cache[key] = (price, now)
                except (ValueError, TypeError, AttributeError):
                    pass

            # only fetch .info when we still lack a name/sector
            if (not name or not sector):
                try:
                    info = tk.info or {}
                    y_name = (info.get("shortName") or info.get("longName") or "").strip()
                    y_sector = _map_sector(info.get("sector"), info.get("industry"))
                    if y_name:
                        name = name or y_name.title()
                    sector = sector or y_sector
                    if name and sector:
                        _profile_cache[key] = (name, sector, now)
                except Exception:
                    pass

            if price is not None:
                return Quote(key, name or key, sector or "Other", price, "live")
        except Exception:
            # yfinance timeout or network issue; try next suffix
            continue

    return None


# ─── batch resolution ────────────────────────────────────────────────────────

def resolve_quotes(tickers: Iterable[str], avg_by_ticker: dict[str, float] | None = None) -> dict[str, Quote]:
    """Resolve many tickers at once. Always returns an entry per input ticker.

    avg_by_ticker supplies the user's buy price, used as the last-resort
    "unpriced" fallback so a return of 0% is at least internally consistent.
    """
    avg_by_ticker = avg_by_ticker or {}
    keys = []
    for t in tickers:
        k = _norm(str(t))
        if k and k not in keys:
            keys.append(k)

    resolved: dict[str, Quote] = {}

    if LIVE_PRICES_ENABLED and keys:
        deadline = time.time() + FETCH_DEADLINE_SECONDS
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(keys))) as pool:
            futures = {pool.submit(_fetch_one, k): k for k in keys}
            try:
                for fut in as_completed(futures, timeout=FETCH_DEADLINE_SECONDS):
                    k = futures[fut]
                    try:
                        q = fut.result(timeout=max(0.1, deadline - time.time()))
                    except Exception:
                        q = None
                    if q:
                        resolved[k] = q
            except Exception:
                # deadline hit — whatever resolved so far still counts
                pass
            finally:
                for fut in futures:
                    fut.cancel()

    # fill the gaps: curated snapshot, then flat-at-avg
    for k in keys:
        if k in resolved:
            continue
        avg = float(avg_by_ticker.get(k) or 0)
        curated = KNOWN_STOCKS.get(k)
        # A curated entry gives a trustworthy name and sector; it no longer
        # carries a price. Either way the quote is unpriced, held at the user's
        # own average, so nothing downstream computes a return against a number
        # we cannot stand behind.
        name, sector = curated if curated else (k, "Other")
        resolved[k] = Quote(k, name, sector, avg if avg > 0 else 0.0, "unpriced")

    return resolved
