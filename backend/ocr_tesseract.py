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
    """Match a line of OCR text against a known ticker or company name."""
    upper = line.upper()
    for ticker, (name, _sector, _cmp) in KNOWN_STOCKS.items():
        if re.search(rf"\b{re.escape(ticker)}\b", upper):
            return ticker
        first_word = name.upper().split()[0]
        if len(first_word) > 3 and first_word in upper:
            return ticker
    return None


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

        # qty is usually the smallest whole-number-looking value under 10,000
        qty_candidates = [n for n in numbers if n < 10_000 and n == int(n)]
        qty = qty_candidates[0] if qty_candidates else min(numbers)
        remaining = [n for n in numbers if n != qty]
        avg = remaining[0] if remaining else None
        if not avg or avg <= 0:
            continue

        holdings.append({"ticker": ticker, "qty": qty, "avg": avg})
        seen.add(ticker)

    return holdings
