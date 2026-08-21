"""
Free, local OCR fallback for screenshot uploads — no API key, no cost.

Uses Tesseract (via pytesseract) to read raw text off a broker-app screenshot,
then heuristically matches lines against KNOWN_STOCKS and pulls out quantity +
average price. This is meaningfully less accurate than Claude vision (varied
fonts, dark themes, cramped columns all trip it up), so results are designed
to be reviewed and corrected by the user before analysis runs — never trusted
blindly. See /api/ocr/extract in main.py, which routes these into the manual-
entry review screen instead of straight into an Analysis.
"""

from __future__ import annotations

import io
import re
from typing import Any

from engine import KNOWN_STOCKS


def _find_ticker_in_line(line: str) -> str | None:
    """Match a line of OCR text against a known ticker or company name.

    Two things were wrong here. The loop returned on the first entry matching
    EITHER test, so a loose company-name hit on an early dict entry beat an exact
    ticker match on a later one. And the name test compared only the first word
    with len > 3, so any shared leading word collided: "TATA MOTORS 10 985"
    matched TATAPOWER (both start "TATA") and "BHARAT FORGE 5 1200" matched BEL
    (Bharat Electronics). Dictionary order silently decided which company the
    user's holding became.

    Now: exact ticker symbols win outright, then full company names as phrases,
    longest match first so "Tata Motors" cannot lose to "Tata Power".
    """
    upper = " ".join(line.upper().split())

    def matched_len(needle: str) -> int:
        """Length of `needle` if it appears as a whole token-run, else 0."""
        if len(needle) < 3:
            return 0
        return (
            len(needle)
            if re.search(rf"(?<![A-Z0-9]){re.escape(needle)}(?![A-Z0-9])", upper)
            else 0
        )

    # Score every candidate by how much of the line it actually explains, and
    # take the longest. Checking tickers before names let a short alias win on
    # position alone: "HDFC Bank 30 1600" matched the ticker HDFC rather than
    # HDFCBANK, and HDFC.NS is delisted post-merger, so the holding came back
    # unpriced. "HDFC BANK" is the longer, more specific match, so it wins.
    best: tuple[int, str] | None = None
    for ticker, (name, _sector) in KNOWN_STOCKS.items():
        span = max(matched_len(ticker), matched_len(" ".join(name.upper().split())))
        if span and (best is None or span > best[0]):
            best = (span, ticker)
    return best[1] if best else None


def _numbers_in_line(line: str) -> list[float]:
    """Pull plausible numeric tokens from a line — strips ₹, commas, %."""
    cleaned = line.replace(",", "").replace("₹", "").replace("%", "")
    return [float(m) for m in re.findall(r"\d+\.?\d*", cleaned) if m not in ("", ".")]


def extract_holdings_tesseract(image_bytes: bytes) -> list[dict[str, Any]]:
    """Best-effort holdings extraction from a screenshot using free OCR.

    Returns [{ticker, qty, avg}, ...] — a heuristic first guess, not a final
    answer. Every result should be shown to the user for confirmation before
    it feeds into analysis.
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return []

    try:
        img = Image.open(io.BytesIO(image_bytes))
        raw_text = pytesseract.image_to_string(img)
    except Exception:
        return []

    holdings: list[dict[str, Any]] = []
    seen: set[str] = set()

    for line in raw_text.split("\n"):
        line = line.strip()
        if len(line) < 3:
            continue
        ticker = _find_ticker_in_line(line)
        if not ticker or ticker in seen:
            continue

        numbers = [n for n in _numbers_in_line(line) if n > 0]
        if len(numbers) < 2:
            continue

        # qty is the SMALLEST whole-number-looking value, not the first one.
        # Taking qty_candidates[0] read a row like "INFY 1,612.00 8 1,445.00"
        # (LTP, qty, avg) as qty=1612 and then avg=8 — both wrong, and both
        # plausible enough on screen to survive review.
        qty_candidates = [n for n in numbers if n < 10_000 and n == int(n)]
        qty = min(qty_candidates) if qty_candidates else min(numbers)
        remaining = [n for n in numbers if n != qty]
        # Of what's left, the smallest is the per-unit price; larger figures on a
        # broker row are totals (invested / current value), not an average.
        avg = min(remaining) if remaining else None
        if not avg or avg <= 0:
            continue

        holdings.append({"ticker": ticker, "qty": qty, "avg": avg})
        seen.add(ticker)

    return holdings
