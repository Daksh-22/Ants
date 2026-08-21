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

# Broker screenshots are the hard case for Tesseract: dark themes, thin
# condensed fonts, tight column spacing, and phone-sized captures. Raw
# image_to_string on those produced mostly noise. These three steps address the
# specific failure modes, in order of how much they buy:
#
#   1. Upscale. Tesseract's models are trained around 300 DPI; a phone
#      screenshot of a holdings row is nowhere near that, and small glyphs are
#      where digit confusion (8/B, 0/O, 1/l, 5/S) comes from.
#   2. Grayscale + autocontrast, then invert if the page is dark. Tesseract
#      expects dark text on light ground; every dark-theme broker app is the
#      exact inverse, which is why those screenshots read worst.
#   3. Binarize. Removes the anti-aliasing halo around thin text.
#
# Tuned conservatively — over-processing (aggressive sharpening, low thresholds)
# closes up the counters in digits and makes accuracy worse, not better.
_UPSCALE = 2
_BINARIZE_THRESHOLD = 140
# Below this mean luminance the image is treated as dark-themed and inverted.
_DARK_MEAN_LUMINANCE = 110

# Tesseract page-segmentation modes to try, in order. A holdings list is a
# table, and PSM 6 ("assume a single uniform block of text") keeps rows intact,
# where the default PSM 3 often shreds columns into separate lines and destroys
# the ticker/qty/price association we depend on.
_PSM_MODES = (6, 4, 3)


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


def _preprocess(img: "Image.Image") -> "Image.Image":
    """Normalise a broker screenshot into something Tesseract can actually read."""
    from PIL import Image, ImageOps

    if img.mode not in ("L", "RGB"):
        img = img.convert("RGB")

    gray = ImageOps.grayscale(img)

    # Dark theme? Invert so we always hand Tesseract dark-on-light.
    histogram = gray.histogram()
    total = sum(histogram) or 1
    mean_luminance = sum(i * n for i, n in enumerate(histogram)) / total
    if mean_luminance < _DARK_MEAN_LUMINANCE:
        gray = ImageOps.invert(gray)

    gray = ImageOps.autocontrast(gray)

    if _UPSCALE > 1:
        gray = gray.resize(
            (gray.width * _UPSCALE, gray.height * _UPSCALE),
            Image.LANCZOS,
        )

    # Binarize last, once the glyphs are large enough to survive it.
    return gray.point(lambda px: 255 if px > _BINARIZE_THRESHOLD else 0, mode="1")


def _best_text(img: "Image.Image") -> str:
    """OCR the image under several page-segmentation modes, keep the best read.

    "Best" = the mode that yields the most lines we can actually turn into a
    holding. Picking by raw character count would reward the mode that produced
    the most noise.
    """
    import pytesseract

    processed = _preprocess(img)
    best_text = ""
    best_score = -1
    for psm in _PSM_MODES:
        try:
            text = pytesseract.image_to_string(processed, config=f"--psm {psm}")
        except Exception:
            continue
        score = sum(
            1
            for line in text.split("\n")
            if _find_ticker_in_line(line) and len([n for n in _numbers_in_line(line) if n > 0]) >= 2
        )
        if score > best_score:
            best_text, best_score = text, score
        # A mode that resolved several rows is good enough; stop paying for more.
        if best_score >= 3:
            break
    return best_text


# Plausibility bounds for a single Indian equity holding. These reject OCR
# artefacts, not unusual portfolios: the point is to catch a misread decimal or
# a total row that slipped through, and hand back nothing rather than feed the
# pricing engine a number no real position has.
_MAX_QTY = 5_000_000        # above this it is almost certainly a value, not a count
_MIN_AVG = 0.5              # sub-rupee "prices" are misreads
_MAX_AVG = 500_000          # MRF, the priciest NSE share, trades near ~1.4L


def _is_plausible(holding: dict[str, Any]) -> bool:
    qty = float(holding.get("qty") or 0)
    avg = float(holding.get("avg") or 0)
    if not (0 < qty <= _MAX_QTY):
        return False
    if not (_MIN_AVG <= avg <= _MAX_AVG):
        return False
    # A row where qty and avg are identical is nearly always the same number
    # read twice out of one column, not a real position.
    if qty == avg:
        return False
    return True


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
        raw_text = _best_text(img)
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

        candidate = {"ticker": ticker, "qty": qty, "avg": avg}
        # Drop implausible rows here rather than downstream. Free OCR's failure
        # mode is confident nonsense — a misread decimal turns 14.5 into 145, and
        # the pricing engine has no way to tell that from a real position.
        if not _is_plausible(candidate):
            continue

        holdings.append(candidate)
        seen.add(ticker)

    return holdings
