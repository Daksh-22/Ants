"""
Price data layer — yfinance integration with caching.
Handles fetching live prices for Indian stocks (NSE/BSE).
"""

import yfinance as yf
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import json
import os
import requests


# Cache file path (optional, for offline MVP)
CACHE_FILE = ".price_cache.json"


def _create_session() -> requests.Session:
  session = requests.Session()
  session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  })
  return session


class PriceCache:
    """Simple in-memory + file cache for stock prices."""

    def __init__(self):
        self.memory_cache: Dict[str, Dict] = {}
        self.load_cache()

    def load_cache(self):
        """Load price cache from disk."""
        if os.path.exists(CACHE_FILE):
            # Corrupt or unreadable cache is recoverable — start empty. Bare
            # `except` also caught KeyboardInterrupt/SystemExit, which made the
            # process unkillable mid-load.
            try:
                with open(CACHE_FILE, "r") as f:
                    self.memory_cache = json.load(f)
            except (OSError, ValueError):
                self.memory_cache = {}

    def save_cache(self):
        """Save price cache to disk. A failed write is not worth failing a request."""
        try:
            with open(CACHE_FILE, "w") as f:
                json.dump(self.memory_cache, f)
        except (OSError, TypeError, ValueError):
            pass

    def get(self, ticker: str) -> Optional[Dict]:
        """Get cached price data. A malformed entry is treated as a miss.

        This used to assume every value was a dict with a parseable ISO
        timestamp. A hand-edited or truncated .price_cache.json therefore raised
        AttributeError (value not a dict) or ValueError (bad timestamp) from a
        call site outside any try block, turning a stale cache file into an
        unhandled 500 on /api/prices/{ticker}.
        """
        cached = self.memory_cache.get(ticker)
        if not isinstance(cached, dict):
            return None
        try:
            cached_at = datetime.fromisoformat(cached.get("cached_at", "2000-01-01"))
        except (TypeError, ValueError):
            return None
        if (datetime.now() - cached_at) < timedelta(hours=1):
            return cached
        return None

    def set(self, ticker: str, data: Dict):
        """Cache price data."""
        data["cached_at"] = datetime.now().isoformat()
        self.memory_cache[ticker] = data
        self.save_cache()


cache = PriceCache()


def get_stock_price(ticker: str) -> Optional[Dict]:
    """
    Fetch current price for a stock (NSE/BSE).
    Returns: {ticker, cmp, change_pct, high_52w, low_52w, pe_ratio, market_cap}
    """

    # Check cache first
    cached = cache.get(ticker)
    if cached:
        return cached

    try:
        # Add .NS for NSE tickers if not already present
        symbol = ticker if ticker.endswith((".NS", ".BO", ".BSE")) else f"{ticker}.NS"

        # Fetch from yfinance with custom session
        session = _create_session()
        stock = yf.Ticker(symbol, session=session)
        info = stock.info or {}

        # Get current price
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        if not current_price:
            return None

        # Calculate change
        previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
        change_pct = 0
        if previous_close:
            change_pct = ((current_price - previous_close) / previous_close) * 100

        data = {
            "ticker": ticker,
            "cmp": round(current_price, 2),
            "change_pct": round(change_pct, 2),
            "high_52w": round(info.get("fiftyTwoWeekHigh", current_price), 2),
            "low_52w": round(info.get("fiftyTwoWeekLow", current_price), 2),
            "pe_ratio": round(info.get("trailingPE", 0), 2),
            "market_cap": info.get("marketCap", 0),
            "volume": info.get("volume", 0),
            "fetched_at": datetime.now().isoformat(),
        }

        # Cache it
        cache.set(ticker, data)
        return data

    except Exception as e:
        print(f"Error fetching price for {ticker}: {str(e)}")
        return None


def get_stock_prices(tickers: List[str]) -> Dict[str, Dict]:
    """Batch fetch prices for multiple stocks."""
    results = {}
    for ticker in tickers:
        price = get_stock_price(ticker)
        if price:
            results[ticker] = price
    return results


def get_portfolio_metrics(holdings: List[Dict]) -> Dict:
    """
    Calculate portfolio metrics with current prices.

    Input: [{"ticker": "TCS", "qty": 10, "buy_price": 3500, "sector": "IT"}, ...]
    Output: {
        "totalInvested": 35000,
        "currentValue": 38500,
        "totalReturn": 3500,
        "returnPct": 10.0,
        "holdings": [...with cmp added...]
    }
    """

    total_invested = 0
    current_value = 0
    positions_with_prices = []

    for holding in holdings:
        ticker = holding["ticker"]
        qty = holding["qty"]
        buy_price = holding["buy_price"]

        invested = qty * buy_price
        total_invested += invested

        # Get current price
        price_data = get_stock_price(ticker)
        if price_data:
            cmp = price_data["cmp"]
            current = qty * cmp
            current_value += current

            gain_loss_pct = (((current - invested) / invested) * 100) if invested > 0 else 0
            positions_with_prices.append({
                **holding,
                "cmp": cmp,
                "current_value": round(current, 2),
                "gain_loss": round(current - invested, 2),
                "gain_loss_pct": round(gain_loss_pct, 2),
                "change_pct": price_data["change_pct"],
            })
        else:
            # If price fetch fails, use buy price as estimate
            current_value += invested
            positions_with_prices.append({
                **holding,
                "cmp": buy_price,
                "current_value": round(invested, 2),
                "gain_loss": 0,
                "gain_loss_pct": 0,
                "change_pct": 0,
            })

    total_return = current_value - total_invested
    return_pct = (total_return / total_invested * 100) if total_invested > 0 else 0

    return {
        "totalInvested": round(total_invested, 2),
        "currentValue": round(current_value, 2),
        "totalReturn": round(total_return, 2),
        "returnPct": round(return_pct, 2),
        "holdings": positions_with_prices,
    }




# REFERENCE_PRICES and get_reference_price() were removed together. The function
# returned a fabricated 100.0 for any unknown ticker, and the table it read was
# stale by roughly the same margin as engine.KNOWN_STOCKS' old reference column
# (TCS 3580 against a live ~2349, HDFCBANK 1624 against ~729). Nothing called
# either one; they were a loaded gun aimed at the next person who needed a
# "fallback price". If a price cannot be fetched, the holding is unpriced.
