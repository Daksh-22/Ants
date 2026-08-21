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
# Raised from 8s: the candidate sweep plus bounded retries buys a materially
# higher live-resolution rate, and it needs room. Enforced now (see below), so a
# larger budget is a ceiling rather than a suggestion.
FETCH_DEADLINE_SECONDS = float(os.environ.get("QUOTE_DEADLINE_SECONDS", "12"))
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


# ─── symbol candidates ──────────────────────────────────────────────────────

# NSE series suffixes that appear in broker exports and CSVs but are not part of
# the Yahoo symbol: RELIANCE-EQ, IDEA-BE, some -BZ/-SM/-ST on restricted series.
_SERIES_SUFFIXES = ("-EQ", "-BE", "-BZ", "-SM", "-ST", "-IQ")

# Exchange suffixes a user (or a pasted CSV) may already have attached. engine's
# _norm strips the dot, so "INFY.NS" arrives as "INFYNS" — without this it is
# treated as an unknown symbol and comes back unpriced.
_EXCHANGE_TAILS = ("NS", "BO", "BSE", "NSE")


def _base_symbol(key: str) -> str:
    """Strip series and exchange decoration down to the bare symbol."""
    out = key.upper().strip()
    for suffix in _SERIES_SUFFIXES:
        if out.endswith(suffix):
            out = out[: -len(suffix)]
            break
    for tail in _EXCHANGE_TAILS:
        # Only strip when something recognisable is left; "NSE" alone is not a
        # decorated symbol, and BOSCHLTD must not lose its "BO".
        if out.endswith(tail) and len(out) > len(tail) + 2:
            candidate = out[: -len(tail)]
            if candidate in KNOWN_STOCKS or len(candidate) >= 3:
                out = candidate
                break
    return out.strip("-")


def _symbol_candidates(key: str) -> list[str]:
    """Yahoo symbols to try for one user-supplied ticker, best first.

    yfinance is strict about suffixes and silently returns nothing for a symbol
    that is merely decorated differently, which is the main reason real Indian
    holdings were landing as "unpriced" with a fabricated 0% return.
    """
    base = _base_symbol(key)
    out: list[str] = []

    def add(symbol: str) -> None:
        if symbol and symbol not in out:
            out.append(symbol)

    # Indian mutual funds are Yahoo "0P…" quote IDs and carry no exchange
    # suffix; an ISIN-style INF… code is the AMFI identifier for the same thing.
    # Coverage for these on Yahoo is patchy — we try, and an unresolved fund
    # still reports honestly as unpriced rather than at a made-up price.
    # An AMFI/ISIN fund code is INF + 9 more characters starting with a digit
    # (INF090I01239). A bare `startswith("INF")` test also caught INFY —
    # Infosys — and routed the single most-held stock in the country down the
    # mutual-fund path, losing its .NS candidate entirely.
    is_amfi_isin = len(base) >= 12 and base.startswith("INF") and base[3].isdigit()
    is_yahoo_fund_id = base.startswith("0P") and len(base) >= 8
    if is_amfi_isin or is_yahoo_fund_id:
        add(base)
        add(f"{base}.BO")
        return out

    # An index (^NSEI) or an already-qualified symbol passes through untouched.
    if key.startswith("^"):
        add(key)
        return out

    add(f"{base}.NS")   # NSE first: better coverage and tighter spreads
    add(f"{base}.BO")   # then BSE, which lists many names NSE does not
    if base != key.upper():
        add(f"{key.upper()}.NS")
        add(f"{key.upper()}.BO")
    add(base)           # bare: ETFs and a few cross-listed names resolve this way
    return out


# Transient Yahoo failures — rate limiting and timeouts — are worth retrying;
# a genuinely unknown symbol is not. Kept small on purpose: resolve_quotes runs
# under an 8s deadline, so a long backoff would just burn the whole budget.
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_SECONDS = (0.4, 1.1)
_TRANSIENT_MARKERS = (
    "too many requests",
    "rate limit",
    "429",
    "timed out",
    "timeout",
    "connection",
    "temporarily",
    "503",
    "502",
    "expecting value",   # yfinance surfaces a throttled HTML body as a JSON error
)


def _is_transient(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".lower()
    return any(marker in text for marker in _TRANSIENT_MARKERS)


def _price_from(tk: Any) -> float | None:
    """Price for one yfinance Ticker, trying each source in reliability order.

    fast_info alone was the failure point: it is empty for a lot of Indian
    symbols, and the previous code then fell through to `.info`, which is slow
    and also frequently missing a price. The daily-close fallback resolves most
    of the remainder.
    """
    try:
        fi = tk.fast_info
        for field in ("lastPrice", "last_price", "regularMarketPrice", "previousClose"):
            try:
                value = fi.get(field) if hasattr(fi, "get") else getattr(fi, field, None)
            except Exception:
                value = None
            if value and float(value) > 0:
                return float(value)
    except Exception:
        pass

    try:
        info = tk.info or {}
        for field in ("currentPrice", "regularMarketPrice", "previousClose", "navPrice"):
            value = info.get(field)
            if value and float(value) > 0:
                return float(value)
    except Exception:
        pass

    # Last resort: the most recent daily close. Slower, but it works for symbols
    # whose quote endpoints are throttled or unpopulated — including mutual funds.
    try:
        hist = tk.history(period="5d")
        if hist is not None and len(hist) > 0:
            closes = [float(c) for c in hist["Close"].tolist() if c and float(c) > 0]
            if closes:
                return closes[-1]
    except Exception:
        pass

    return None


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

    # Need the network. Sweep the candidate symbols, retrying the whole sweep
    # when the failures look transient (throttling) rather than "no such symbol".
    candidates = _symbol_candidates(key)

    for attempt in range(_RETRY_ATTEMPTS):
        saw_transient = False

        for symbol in candidates:
            try:
                tk = yf.Ticker(symbol)

                if price is None:
                    found = _price_from(tk)
                    if found is not None:
                        price = found
                        _price_cache[key] = (price, time.time())

                # Only pay for .info when we still lack a name or sector.
                if not name or not sector:
                    try:
                        info = tk.info or {}
                        y_name = (info.get("shortName") or info.get("longName") or "").strip()
                        y_sector = _map_sector(info.get("sector"), info.get("industry"))
                        if y_name:
                            name = name or y_name.title()
                        sector = sector or y_sector
                        if name and sector:
                            _profile_cache[key] = (name, sector, time.time())
                    except Exception as exc:
                        saw_transient = saw_transient or _is_transient(exc)

                if price is not None:
                    return Quote(key, name or key, sector or "Other", price, "live")
            except Exception as exc:
                saw_transient = saw_transient or _is_transient(exc)
                continue

        # Every candidate failed. Retry only if it looked like throttling —
        # re-running a sweep for a symbol Yahoo simply does not list is waste,
        # and it spends a deadline the rest of the batch needs.
        if not saw_transient or attempt >= _RETRY_ATTEMPTS - 1:
            break
        time.sleep(_RETRY_BACKOFF_SECONDS[min(attempt, len(_RETRY_BACKOFF_SECONDS) - 1)])

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
        # NOT a `with` block. Exiting one calls shutdown(wait=True), which waits
        # for every RUNNING fetch — so the deadline was advisory: a batch of 10
        # tickers where two needed retries plus the daily-close fallback took
        # ~15s against an 8s budget, because the loop had returned but the block
        # exit was still blocking. Cancel what is queued, don't wait on the rest.
        pool = ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(keys)))
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
            pool.shutdown(wait=False)

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
