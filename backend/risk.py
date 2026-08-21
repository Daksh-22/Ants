"""
Real per-ticker risk statistics from actual price history.

Why this exists: risk was previously derived from a hardcoded sector→volatility
lookup table. Ten of the twenty-two sector labels the pricing layer can emit
(Industrials, Materials, NBFC, Financial, Insurance, Telecom, Real Estate,
Index ETF, International ETF, Consumer) were missing from that table, so they
silently fell through to a 22.0% default. Every metric downstream — Sharpe,
beta, estimated drawdown, the composite risk score — was therefore computed
from a constant for most real portfolios. It didn't look random so much as
*inert*: the numbers barely moved when the holdings changed, which is exactly
what erodes trust in a risk screen.

This computes the real thing from daily closes:

    daily returns  r_t = P_t / P_{t-1} - 1
    volatility     σ_annual = stdev(r) * sqrt(252)
    beta           cov(r_stock, r_nifty) / var(r_nifty)
    max drawdown   min over t of (P_t / running_max(P) - 1)

Same shape as quotes.py: one cached, concurrent, deadline-bounded batch, and
`None` rather than a fabricated fallback when history isn't available.
"""

from __future__ import annotations

import logging
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Iterable, Optional

from engine import _norm

logging.getLogger("yfinance").setLevel(logging.CRITICAL)

TRADING_DAYS = 252
HISTORY_PERIOD = "1y"
MIN_BARS = 60  # under ~3 months of data, an annualized figure is noise
TTL_SECONDS = 12 * 60 * 60  # risk stats move slowly; refresh twice a day
FETCH_DEADLINE_SECONDS = float(os.environ.get("RISK_DEADLINE_SECONDS", "12"))
MAX_WORKERS = 8

BENCHMARK_SYMBOL = "^NSEI"  # Nifty 50, for beta

_cache: dict[str, tuple["TickerRisk", float]] = {}
_bench_cache: tuple[dict[str, float], float] | None = None


@dataclass
class TickerRisk:
    ticker: str
    #  annualized standard deviation of daily returns, %
    volatility_pct: float
    #  vs Nifty 50; None when the benchmark series is unavailable
    beta: Optional[float]
    #  worst peak-to-trough over the window, % (negative)
    max_drawdown_pct: float
    #  price return across the whole HISTORY_PERIOD window (1y), %. Exists so
    #  Sharpe can divide a 1-year return by a 1-year volatility; the holdings
    #  summary only knows return-since-purchase, which is a different horizon.
    period_return_pct: float
    #  how many daily bars backed the calculation — the UI can hedge on thin data
    bars: int


def _daily_returns(closes: list[float]) -> list[float]:
    return [
        closes[i] / closes[i - 1] - 1
        for i in range(1, len(closes))
        if closes[i - 1] > 0
    ]


def _stdev(xs: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mean = sum(xs) / n
    return math.sqrt(sum((x - mean) ** 2 for x in xs) / (n - 1))


def _max_drawdown(closes: list[float]) -> float:
    peak = closes[0]
    worst = 0.0
    for p in closes:
        peak = max(peak, p)
        if peak > 0:
            worst = min(worst, p / peak - 1)
    return worst * 100


def _closes(symbol: str) -> list[tuple[str, float]]:
    """[(iso date, close)] ascending. Dates are kept so two series can be
    aligned by trading day — NSE and the index don't always share a calendar,
    and aligning by list position instead drove every beta toward zero."""
    try:
        import yfinance as yf

        hist = yf.Ticker(symbol).history(period=HISTORY_PERIOD)
        if hist is None or len(hist) < MIN_BARS:
            return []
        out: list[tuple[str, float]] = []
        for idx, close in zip(hist.index, hist["Close"].tolist()):
            if close and close > 0:
                out.append((str(idx.date()), float(close)))
        return out
    except Exception:
        return []


def _returns_by_date(series: list[tuple[str, float]]) -> dict[str, float]:
    """date -> that day's return, so two series can be intersected on dates."""
    out: dict[str, float] = {}
    for i in range(1, len(series)):
        prev, cur = series[i - 1][1], series[i][1]
        if prev > 0:
            out[series[i][0]] = cur / prev - 1
    return out


def _benchmark_returns() -> dict[str, float]:
    """Nifty daily returns keyed by date, cached. Empty when unavailable."""
    global _bench_cache
    now = time.time()
    if _bench_cache and (now - _bench_cache[1]) < TTL_SECONDS:
        return _bench_cache[0]
    rets = _returns_by_date(_closes(BENCHMARK_SYMBOL))
    if rets:
        _bench_cache = (rets, now)
    return rets


def _fetch_one(key: str, bench: dict[str, float]) -> Optional[TickerRisk]:
    now = time.time()
    hit = _cache.get(key)
    if hit and (now - hit[1]) < TTL_SECONDS:
        return hit[0]

    series: list[tuple[str, float]] = []
    for suffix in (".NS", ".BO"):
        series = _closes(f"{key}{suffix}")
        if series:
            break
    if len(series) < MIN_BARS:
        return None

    by_date = _returns_by_date(series)
    rets = list(by_date.values())
    if len(rets) < 2:
        return None

    vol = _stdev(rets) * math.sqrt(TRADING_DAYS) * 100

    beta: Optional[float] = None
    if bench:
        # Intersect on shared trading days. Aligning by list position pairs a
        # stock's return with the wrong day's index return wherever the
        # calendars diverge, which collapses the covariance toward zero.
        shared = sorted(set(by_date) & set(bench))
        if len(shared) >= MIN_BARS:
            a = [by_date[d] for d in shared]
            b = [bench[d] for d in shared]
            n = len(shared)
            mb = sum(b) / n
            var_b = sum((x - mb) ** 2 for x in b) / (n - 1)
            if var_b > 0:
                ma = sum(a) / n
                cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / (n - 1)
                beta = round(cov / var_b, 2)

    closes = [c for _, c in series]
    period_return = ((closes[-1] / closes[0] - 1) * 100) if closes[0] > 0 else 0.0

    risk = TickerRisk(
        ticker=key,
        volatility_pct=round(vol, 1),
        beta=beta,
        max_drawdown_pct=round(_max_drawdown(closes), 1),
        period_return_pct=round(period_return, 1),
        bars=len(series),
    )
    _cache[key] = (risk, now)
    return risk


def resolve_risk(tickers: Iterable[str]) -> dict[str, TickerRisk]:
    """Real risk stats per ticker. Missing keys mean 'unknown' — never guessed."""
    keys: list[str] = []
    for t in tickers:
        k = _norm(str(t))
        if k and k not in keys:
            keys.append(k)
    if not keys:
        return {}

    bench = _benchmark_returns()
    out: dict[str, TickerRisk] = {}
    try:
        pool = ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(keys)))
        futures = {pool.submit(_fetch_one, k, bench): k for k in keys}
        try:
            for fut in as_completed(futures, timeout=FETCH_DEADLINE_SECONDS):
                try:
                    r = fut.result(timeout=1)
                except Exception:
                    r = None
                if r:
                    out[r.ticker] = r
        finally:
            # FETCH_DEADLINE_SECONDS was advisory only. `with ThreadPoolExecutor`
            # exits via shutdown(wait=True), which waits for every QUEUED task to
            # run to completion — so a 60-ticker book still performed all 60
            # yfinance fetches after the deadline had passed, holding the worker
            # long past the budget. Cancel what hasn't started, then don't wait on
            # what has.
            for fut in futures:
                fut.cancel()
            pool.shutdown(wait=False)
    except Exception:
        pass  # deadline hit — partial results are fine, absent keys stay unknown
    return out


def portfolio_risk(holdings: list[dict], risks: dict[str, TickerRisk]) -> dict:
    """Weight-aware portfolio risk from per-holding stats.

    Returns coverage alongside the numbers so the UI can say how much of the
    book the figure actually covers instead of implying it covers all of it.
    """
    sum_w_sigma = 0.0        # Σ wᵢσᵢ
    sum_w2_sigma2 = 0.0      # Σ wᵢ²σᵢ²
    weighted_beta = 0.0
    beta_weight = 0.0        # weight of holdings that actually HAVE a beta
    weighted_return = 0.0
    return_weight = 0.0
    covered_weight = 0.0

    for h in holdings:
        r = risks.get(_norm(str(h.get("ticker", ""))))
        if not r:
            continue
        w = float(h.get("weightPct") or 0) / 100
        covered_weight += w
        sum_w_sigma += w * r.volatility_pct
        sum_w2_sigma2 += (w * r.volatility_pct) ** 2
        weighted_return += w * r.period_return_pct
        return_weight += w
        # Beta is tracked against its OWN weight. Dividing by covered_weight
        # instead diluted the result by holdings whose beta could not be
        # measured: a 50/50 book with one beta of 1.2 and one unmeasurable
        # reported 0.6 — "half as market-sensitive as the index" for a book
        # that is more sensitive than it.
        if r.beta is not None:
            weighted_beta += w * r.beta
            beta_weight += w

    if covered_weight <= 0:
        return {"available": False, "coveragePct": 0.0}

    # Uniform-pairwise-correlation model:
    #     σ_p² = Σwᵢ²σᵢ² + ρ·ΣΣ_{i≠j} wᵢwⱼσᵢσⱼ  =  ρ·S² + (1−ρ)·Q
    # where S = Σwᵢσᵢ and Q = Σwᵢ²σᵢ². This replaces a flat 1.25x uplift on a
    # zero-correlation sum-of-squares, which was wrong at both ends: for a
    # single-holding book, portfolio vol IS the asset's vol, yet a real 22% was
    # reported as 27.5%. Here the cross terms vanish when there is only one
    # holding, so the identity holds automatically, and ρ=1 collapses to the
    # weighted average as it should.
    RHO = 0.35  # typical pairwise correlation across Indian equities
    var_p = RHO * (sum_w_sigma ** 2) + (1 - RHO) * sum_w2_sigma2
    vol = math.sqrt(max(var_p, 0.0)) / max(covered_weight, 1e-9)

    return {
        "available": True,
        "volatilityPct": round(vol, 1),
        # `if weighted_beta else None` erased a genuine portfolio beta of
        # exactly 0.0, reporting "unknown" for a real measurement. Presence is
        # decided by whether any weight carried a beta, not by the value.
        "beta": round(weighted_beta / beta_weight, 2) if beta_weight > 0 else None,
        # Trailing-window return over the holdings we could measure, for a
        # horizon-matched Sharpe. None when nothing was measurable.
        "periodReturnPct": round(weighted_return / return_weight, 1) if return_weight > 0 else None,
        "coveragePct": round(covered_weight * 100, 1),
    }
