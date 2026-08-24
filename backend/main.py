"""
Ants backend — FastAPI service powering the Ants frontend.

    uvicorn main:app --reload --port 8000        (from backend/)

Domains:
  1. Portfolio analysis  — real math (engine.py) + optional Gemini polish (ai.py)
  2. Screenshot OCR      — Gemini vision → holdings → analysis
  3. Ask Ants            — RAG-grounded chat (rag.py + ai.py)
  4. Index benchmarks    — live Nifty 50 / Sensex / Midcap trailing returns
  5. Cohort ranking      — real anonymous percentile (database.py), not invented

Deliberately NOT implemented — these return 503 rather than simulated data,
because each previously returned invented values the UI presented as real:
  * Account Aggregator (broker linking) — AA_ENABLED
  * Order execution                     — EXECUTION_ENABLED
  * Swarm Radar momentum feed           — SWARM_RADAR_ENABLED
  * Accounts / portfolios               — needs SUPABASE_URL + SUPABASE_KEY

Env: GEMINI_API_KEY (optional — enables AI), GEMINI_MODEL,
     ALLOWED_ORIGINS (comma-separated, for the deployed frontend), PORT.
     Read from the process env first, then backend/.env.local, then
     backend/.env — so a hosting dashboard always overrides a local file.
"""

from __future__ import annotations

import asyncio
import base64
import os
import random
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Environment, before anything reads it ───────────────────────────────────
# python-dotenv was a dependency that nothing ever called, so backend/.env and
# backend/.env.local — both holding a real ANTHROPIC_API_KEY, JWT_SECRET and
# Supabase credentials — were never loaded. Running `uvicorn main:app` picked up
# none of it: AI silently degraded to fallback, accounts stayed disabled, and
# JWT signing fell back to its development default.
#
# This has to run BEFORE the local imports below. ai.py, auth.py and
# database.py all read os.environ at module scope, so importing them first
# freezes in the unset values no matter what we load afterwards. The import
# placement is deliberate, not an oversight — hence the noqa.
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
# override=False means real process env wins over both files, and .env.local
# wins over .env — the platform dashboard stays the source of truth in
# production, while a local file can shadow the committed defaults.
load_dotenv(_BACKEND_DIR / ".env.local", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=False)

import ai  # noqa: E402
import benchmarks  # noqa: E402
import engine  # noqa: E402
import rag  # noqa: E402
import auth  # noqa: E402
import database  # noqa: E402
import prices  # noqa: E402
import risk as risk_stats  # noqa: E402
import ocr_tesseract  # noqa: E402
from csv_importer import csv_to_holdings  # noqa: E402

app = FastAPI(
    title="Ants Backend",
    description="Honest portfolio breakdowns for Indian Gen Z — analysis, AI, RAG, AA, execution.",
    version="2.0.0",
)

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development").strip().lower() == "production"

# Vercel mints a NEW hostname for every single deployment
# (ants-<random-hash>-<scope>.vercel.app), so an exact-match ALLOWED_ORIGINS
# list goes stale the moment you redeploy: the browser's Origin no longer
# appears in the list, the preflight is refused, and fetch rejects with a bare
# TypeError. The client reports that as "Couldn't reach the Ants server", which
# is indistinguishable from the backend being down — so the obvious next move
# is to redeploy, which mints yet another hostname and reproduces the failure.
# That loop cost a full debugging session. Matching this project's deployments
# by pattern is stable across redeploys and ends the loop.
#
# This MUST stay scoped to this project's own hostnames. Never widen it to
# something like `.*\.vercel\.app` — allow_credentials=True means any origin
# this matches can read authenticated responses, so a wildcard would hand that
# to every page hosted on Vercel. Starlette fullmatch()es this pattern.
#
# The middle segment allows hyphens because Vercel's branch URLs carry the
# branch name (ants-git-main-<scope>.vercel.app), not just a hash. The required
# `-daksh-s-projects22` suffix is what keeps this scoped to this account.
_PROJECT_ORIGIN_REGEX = r"https://(?:ants-delta|ants-[a-z0-9-]+-daksh-s-projects22)\.vercel\.app"

# Escape hatch for renaming the project or adding a custom domain without a
# code change. Same rule applies: keep it narrow.
_configured_origin_regex = os.environ.get("ALLOWED_ORIGIN_REGEX", "").strip() or _PROJECT_ORIGIN_REGEX

# The any-localhost-port regex is a development convenience: it lets `next dev`
# work on whatever port it grabs. It was OR'd with allow_origins unconditionally,
# so the deployed API also accepted CREDENTIALED cross-origin requests from
# http://localhost:<anything> — any other app or notebook running on a user's
# machine could read their authenticated responses. In production only the
# explicit ALLOWED_ORIGINS list and the project-scoped pattern are honoured.
_dev_origin_regex = None if IS_PRODUCTION else r"http://(?:localhost|127\.0\.0\.1):\d+"

# One combined pattern — CORSMiddleware accepts only a single regex. Each branch
# is wrapped so alternation can't leak across branches under fullmatch.
_origin_regex = "|".join(
    f"(?:{p})" for p in (_configured_origin_regex, _dev_origin_regex) if p
) or None

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_origin_regex,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ──────────────────────────────────────────────────────────────────

class Position(BaseModel):
    ticker: str
    qty: float = Field(..., gt=0)
    avg: float = Field(..., gt=0)


# Every position triggers a blocking yfinance lookup. ResolveRequest was already
# capped at 50; these were not, so one unauthenticated POST with 300 tickers
# serialized ~300 network fetches and starved every other request on the worker.
MAX_POSITIONS = 60


class AnalyzeRequest(BaseModel):
    positions: List[Position] = Field(..., max_length=MAX_POSITIONS)
    source: str = "manual"


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)
    analysis: Optional[dict] = None


class AASyncRequest(BaseModel):
    userId: str
    mobile: str = Field(..., min_length=10, max_length=10)


class OrderRequest(BaseModel):
    symbol: str
    qty: int
    price: float
    order_type: str = "LIMIT"


MAX_IMAGE_BYTES = 8_000_000
MAX_CSV_BYTES = 2_000_000


async def _read_capped(file: UploadFile, limit: int, over_limit_detail: str) -> bytes:
    """Read an upload in chunks, aborting the moment it exceeds `limit`.

    `await file.read()` buffers the ENTIRE body and only then compares its
    length, so the 8MB check ran after the bytes were already in memory: a 2GB
    POST exhausted the worker before the 413 could be written. Reading in chunks
    means an oversized body costs one chunk past the limit, not all of it.
    """
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(status_code=413, detail=over_limit_detail)
        chunks.append(chunk)
    return b"".join(chunks)


def _written(row: Any, what: str) -> Any:
    """Return a write's result, or fail loudly if the store gave us nothing.

    Supabase inserts return an empty `data` list when the write is rejected —
    an RLS policy denial, most commonly — and the db layer maps that to None.
    Every one of these endpoints returned that None straight through with a 200,
    so the client received the JSON literal `null` for what looked like a
    successful create and only broke later, somewhere unrelated.
    """
    if row is None:
        raise HTTPException(status_code=502, detail=f"Couldn't save the {what}. Try again.")
    return row


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["Ops"])
async def healthz():
    """Liveness + a truthful account of which optional subsystems actually work.

    aiEnabled only means a key is present. aiLastError is what matters: a key
    that the API rejects looks fully healthy from the outside otherwise, because
    every AI call degrades silently to the deterministic fallback.
    """
    return {
        "status": "ok",
        "aiEnabled": ai.have_ai(),
        # The model actually in use, which is not necessarily GEMINI_MODEL: a
        # configured name the key does not serve gets replaced by a discovered
        # one. Reporting the config here hid exactly that mismatch.
        "aiModel": ai.active_model(),
        "aiConfiguredModel": ai.MODEL,
        "aiLastError": ai.last_error(),
        "knowledgeChunks": rag.chunk_count(),
        "accountsEnabled": database.db.client is not None,
        "brokerLinkEnabled": AA_ENABLED,
        "executionEnabled": EXECUTION_ENABLED,
    }


# ─── 1. Portfolio analysis ───────────────────────────────────────────────────

@app.post("/api/analyze", tags=["Analysis"])
def analyze_portfolio(payload: AnalyzeRequest):
    """Positions → full Analysis (engine math, AI-polished copy when available)."""
    try:
        analysis = engine.analyze([p.model_dump() for p in payload.positions], source=payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    polished = ai.polish_analysis(analysis)

    # Anonymous cohort sample for /api/rank — no identity, just the two
    # numbers. This is a sync def (FastAPI runs it in a worker thread), so
    # there's no existing event loop to conflict with asyncio.run here.
    # Never let this affect the response the user is waiting on.
    try:
        asyncio.run(database.db.log_anonymous_return(
            polished["summary"]["returnsPct"], polished["summary"]["totalValue"]
        ))
    except Exception:
        pass

    return polished


@app.get("/api/analyze/demo", tags=["Analysis"])
def analyze_demo(source: str = "demo"):
    """The Arjun Mehta demo portfolio through the same real engine.

    `source` is what the UI reads to decide whether to show the "sample
    portfolio" banner. Echoing an arbitrary caller-supplied string let
    ?source=broker relabel the demo book as an Account Aggregator sync — exactly
    the "fake data presented as real" this module's docstring says was removed.
    """
    if source != "demo":
        raise HTTPException(
            status_code=400,
            detail="The demo portfolio is only ever source=demo.",
        )
    return engine.demo_analysis(source="demo")


def _risk_shares(holdings: list[dict], per_ticker: dict) -> list[dict]:
    """Per-holding share of portfolio risk, normalised to sum to 100.

    Uses wᵢσᵢ / Σwⱼσⱼ — the contribution each holding makes to weighted
    volatility. It is a simplification (a full decomposition needs the
    covariance matrix, and risk.py models correlation as a single uniform rho),
    but it has the property the UI actually claims: the numbers are shares of
    one whole, so they add to 100% and a single holding owns 100% of its own
    risk. Returns [] when nothing measurable is left to divide by.
    """
    rows = []
    for h in holdings:
        k = engine._norm(str(h["ticker"]))
        r = per_ticker.get(k)
        if not r:
            continue
        rows.append((h, r, float(h.get("weightPct") or 0) / 100 * r.volatility_pct))

    total = sum(w for _, _, w in rows)
    if total <= 0:
        return []

    return [
        {
            "ticker": h["ticker"],
            "sector": h["sector"],
            "volatility_pct": r.volatility_pct,
            "contribution_to_portfolio_risk": round(w / total * 100, 1),
        }
        for h, r, w in rows
    ]


@app.post("/api/metrics", tags=["Analysis"])
def portfolio_metrics(payload: AnalyzeRequest):
    """Positions → risk metrics: volatility, Sharpe, est. max drawdown, beta,
    composite risk score, plus per-holding risk contributions."""
    try:
        analysis = engine.analyze([p.model_dump() for p in payload.positions], source=payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    holdings = analysis["holdings"]

    # Real per-ticker volatility/beta/drawdown from 1y of daily closes. This
    # replaces a sector -> volatility lookup table in which 10 of the 22 sector
    # labels the pricing layer emits were missing, so most holdings silently
    # took a 22.0% default and the whole risk screen barely moved when the
    # portfolio changed.
    per_ticker = risk_stats.resolve_risk([h["ticker"] for h in holdings])
    book = risk_stats.portfolio_risk(holdings, per_ticker)

    if not book.get("available"):
        # No history for anything we hold — say so instead of inventing a score.
        return {
            "risk": None,
            "holdingVolatilities": [],
            "note": "Not enough price history to measure risk for these holdings.",
            "coveragePct": 0.0,
        }

    vol = book["volatilityPct"]
    RISK_FREE_PCT = 6.0  # ~1y Indian government bond

    # Sharpe needs both terms on the same horizon. This used to divide
    # summary.returnsPct — return SINCE PURCHASE, possibly several years — by an
    # ANNUALISED volatility, so a user up 120% since 2020 on a 25%-vol book was
    # shown 4.56, which reads as world-class when the honest figure is under 1.
    # risk.py now reports the trailing 1-year return of the same price series the
    # volatility comes from, so the ratio is dimensionally coherent. When that
    # window isn't measurable we omit the ratio rather than mixing horizons.
    annual_ret = book.get("periodReturnPct")
    sharpe = round((annual_ret - RISK_FREE_PCT) / vol, 2) if (annual_ret is not None and vol > 0) else None

    # Weight-aware worst historical drawdown across the book.
    dd_num = sum(
        (float(h.get("weightPct") or 0) / 100) * per_ticker[k].max_drawdown_pct
        for h in holdings
        if (k := engine._norm(str(h["ticker"]))) in per_ticker
    )
    covered = book["coveragePct"] / 100 or 1.0

    # 0 = punishing, 100 = calm. 12% annualised vol is index-like, 45% is a
    # single-name speculative book; clamp and invert linearly between them.
    risk_score = max(0, min(100, round((45 - vol) / (45 - 12) * 100)))

    return {
        "risk": {
            "volatility_pct": vol,
            "sharpe_ratio": sharpe,
            "max_drawdown_pct": round(dd_num / covered, 1),
            "beta_vs_nifty": book.get("beta"),
            "risk_score": risk_score,
        },
        # Shares of risk, normalised to sum to 100 across the measured holdings.
        # This was wᵢ·σᵢ in raw volatility POINTS, rendered with a "%" suffix
        # under a "biggest risk contributors" heading: three equal-weight
        # holdings at 30% vol each read "10%, 10%, 10%" — as though they made up
        # 30% of the risk when they are the entire book. A lone holding reported
        # "30%" of its own risk.
        "holdingVolatilities": _risk_shares(holdings, per_ticker),
        # What share of the book these numbers actually cover — the UI should
        # hedge rather than imply full coverage on a partially-resolved book.
        "coveragePct": book["coveragePct"],
    }


class ResolveRequest(BaseModel):
    tickers: List[str] = Field(..., max_length=50)


@app.post("/api/resolve", tags=["Analysis"])
def resolve_tickers(payload: ResolveRequest):
    """Validate tickers before analysis: which resolve, to what, at what price.

    Without this, a typo silently became a holding — an unresolvable symbol
    falls back to the user's own average price, which reads as a real position
    sitting at exactly 0.0%. The entry form uses this to confirm each symbol
    while the user types, so bad data is caught before it reaches the analysis
    rather than quietly diluting it.
    """
    import quotes as quotes_mod

    cleaned = [t for t in (str(x).strip() for x in payload.tickers) if t][:50]
    if not cleaned:
        return {"results": []}

    resolved = quotes_mod.resolve_quotes(cleaned, {})
    out = []
    for raw in cleaned:
        key = engine._norm(raw)
        q = resolved.get(key)
        # "found" answers "is this a real symbol?", which is a different question
        # from "can we price it right now?". Conflating them meant that with the
        # stale-snapshot tier removed, a Yahoo outage made every valid ticker
        # report as a typo — the form would tell someone RELIANCE doesn't exist
        # and suggest checking the spelling. Recognition comes from a live hit or
        # the curated table; the price is reported separately and may be null.
        live = bool(q and q.source == "live" and q.price > 0)
        found = live or key in engine.KNOWN_STOCKS
        out.append({
            "input": raw,
            "ticker": key,
            "found": found,
            "name": q.name if (found and q) else None,
            "sector": q.sector if (found and q) else None,
            "cmp": round(q.price, 2) if live else None,
            "priceSource": q.source if q else "unpriced",
        })
    return {"results": out}


class QuotesRequest(BaseModel):
    tickers: List[str] = Field(..., max_length=50)


@app.post("/api/quotes", tags=["Prices"])
def live_quotes(payload: QuotesRequest):
    """Current price per ticker, for re-evaluating something against the market.

    Price alerts previously compared their targets against whatever quote was
    frozen into the stored analysis, so an alert could only ever resolve using
    prices that might be hours or days old — a target could be crossed and the
    alert would sit there inactive until the user happened to re-run an analysis.
    This lets the client re-price on open.

    Deliberately built on quotes.resolve_quotes rather than prices.py: the latter
    reports a failed lookup as a real 0% and would let an alert "fire" against a
    price we never actually got. Anything unresolved comes back source
    "unpriced" with price 0 and the caller must skip it.
    """
    cleaned = [t for t in (str(x).strip() for x in payload.tickers) if t][:50]
    if not cleaned:
        return {"quotes": {}}

    import quotes as quotes_mod

    resolved = quotes_mod.resolve_quotes([engine._norm(t) for t in cleaned], {})
    return {
        "quotes": {
            key: {"price": round(q.price, 2), "source": q.source}
            for key, q in resolved.items()
        },
        "asOf": datetime.now(timezone.utc).isoformat(),
    }


class CheckRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=40)
    positions: List[Position] = Field(..., max_length=MAX_POSITIONS)


@app.post("/api/check", tags=["Analysis"])
def check_tip(payload: CheckRequest):
    """Tip Check — what buying this ticker actually does to YOUR portfolio.
    Facts + tone from the engine; verdict wording sharpened by AI when enabled."""
    try:
        analysis = engine.analyze([p.model_dump() for p in payload.positions], source="check")
        result = engine.check_ticker(analysis, payload.ticker)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return ai.polish_verdict(result, analysis["holdings"])


# ─── 2. Screenshot OCR ───────────────────────────────────────────────────────

@app.post("/api/ocr/screenshot", tags=["Analysis"])
async def ocr_screenshot(file: UploadFile = File(...)):
    """Holdings screenshot → Claude vision extraction → Analysis.

    Prefer /api/ocr/extract: it returns holdings for the user to confirm before
    any analysis runs, which is the honest flow for a best-effort OCR read.
    This endpoint used to fall back to the built-in demo portfolio when the
    read failed — a different user's numbers, presented as an analysis of your
    screenshot. It now fails instead.
    """
    if file.content_type not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
        raise HTTPException(status_code=415, detail="Upload a PNG/JPEG/WebP screenshot.")
    raw = await _read_capped(
        file, MAX_IMAGE_BYTES, "Image over 8MB — crop to the holdings list."
    )

    media_type = _sniff_image(raw)
    if media_type is None:
        raise HTTPException(status_code=415, detail="That file isn't a readable image. Upload a PNG/JPEG/WebP screenshot.")

    # These three are blocking: a multi-second vision call, then a batch of
    # yfinance fetches, then another model call. This handler has to stay async
    # for `await file.read()`, so the blocking work is pushed to the threadpool
    # explicitly — otherwise one screenshot upload parks the event loop for
    # seconds and every other request, /healthz included, waits behind it.
    holdings = await run_in_threadpool(
        ai.extract_holdings, base64.standard_b64encode(raw).decode(), media_type
    )
    if holdings:
        try:
            analysis = await run_in_threadpool(engine.analyze, holdings, source="screenshot")
            polished = await run_in_threadpool(ai.polish_analysis, analysis)
            return {**polished, "aiUsed": True}
        except ValueError:
            pass

    detail = "Couldn't read any holdings from that screenshot. Try a clearer, cropped photo, or enter your positions manually."
    if ai.last_error():
        detail = "Screenshot reading is unavailable right now. Enter your positions manually — it takes about a minute."
    raise HTTPException(status_code=422, detail=detail)


def _sniff_image(raw: bytes) -> Optional[str]:
    """Real media type from magic bytes, or None if it isn't an image we accept."""
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    if raw.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    return None


@app.post("/api/ocr/extract", tags=["Analysis"])
async def ocr_extract(file: UploadFile = File(...)):
    """Screenshot → best-effort extracted holdings for the user to REVIEW,
    not a final analysis. Uses Claude vision when ANTHROPIC_API_KEY is set
    (accurate); otherwise falls back to free local Tesseract OCR (rougher —
    the frontend routes these into an editable form rather than trusting
    them blindly). Never silently substitutes demo data."""
    if file.content_type not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
        raise HTTPException(status_code=415, detail="Upload a PNG/JPEG/WebP screenshot.")
    raw = await _read_capped(
        file, MAX_IMAGE_BYTES, "Image over 8MB — crop to the holdings list."
    )

    # content_type is client-supplied and trivially spoofed. Sniff the real
    # bytes so a mislabelled file fails here with a clear message instead of
    # deep inside the vision call.
    media_type = _sniff_image(raw)
    if media_type is None:
        raise HTTPException(status_code=415, detail="That file isn't a readable image. Upload a PNG/JPEG/WebP screenshot.")

    ai_failed = False
    if ai.have_ai():
        holdings = await run_in_threadpool(
            ai.extract_holdings, base64.standard_b64encode(raw).decode(), media_type
        )
        if holdings:
            return {"holdings": holdings, "method": "ai_vision"}
        ai_failed = True

    # Tesseract shells out to a native binary and is CPU-bound; on the event
    # loop it blocks just as hard as a network call.
    holdings = await run_in_threadpool(ocr_tesseract.extract_holdings_tesseract, raw)
    if holdings:
        note = "Read with free OCR — double-check these numbers before analyzing."
        if ai_failed and ai.last_error():
            # Don't quietly hand back the weaker read as if it were the good one.
            note = "Accurate reading is unavailable right now, so this used free OCR — check every number before analyzing."
        return {"holdings": holdings, "method": "tesseract", "note": note}

    note = "Couldn't read any holdings from that screenshot. Try a clearer, cropped photo or enter positions manually."
    if ai_failed and ai.last_error():
        note = "Screenshot reading is down right now. Enter your positions manually — it takes about a minute."
    return {"holdings": [], "method": "none", "note": note}


# ─── 3. Ask Ants (RAG chat) ─────────────────────────────────────────────────

@app.post("/api/chat", tags=["AI"])
def ask_ants(payload: ChatRequest):
    return ai.chat(payload.question, payload.analysis)


@app.get("/api/rag/search", tags=["AI"])
def rag_search(q: str, k: int = 4):
    # min(k, 10) let k=-1 through, and rag.retrieve slices ranked[:-1] — which
    # returns everything but the last chunk instead of a top-k. Clamp both ends.
    return {"query": q, "results": rag.retrieve(q, k=max(1, min(k, 10)))}


# ─── 4. Account Aggregator ──────────────────────────────────────────────────
#
# NOT IMPLEMENTED. These endpoints previously returned the built-in Arjun Mehta
# demo portfolio to EVERY caller, while the UI presented it as "your broker
# data". That is the single most misleading thing this app could ship, so both
# endpoints now fail loudly instead of lying quietly.
#
# To turn this on for real you need a licensed AA aggregator (Setu, Finvu,
# Onemoney) — that requires an RBI-regulated FIU registration and a commercial
# agreement. Wire the real client here, then flip AA_ENABLED.

AA_ENABLED = os.environ.get("AA_ENABLED", "0") == "1"
_AA_UNAVAILABLE = (
    "Broker linking isn't available yet — it needs a licensed Account Aggregator "
    "connection. Upload a screenshot or enter your holdings manually instead."
)


@app.post("/api/aa/initiate-sync", tags=["Account Aggregator"])
async def initiate_aa_sync(payload: AASyncRequest):
    """Step 1: FIU requests consent. Requires a real AA aggregator integration."""
    if not AA_ENABLED:
        raise HTTPException(status_code=503, detail=_AA_UNAVAILABLE)
    raise HTTPException(status_code=501, detail="AA_ENABLED is set but no aggregator client is wired up.")


@app.post("/api/aa/webhook", tags=["Account Aggregator"])
async def aa_data_ready_webhook(consentHandle: str):
    """Step 2: consent approved → decrypted FIP holdings → real analysis."""
    if not AA_ENABLED:
        raise HTTPException(status_code=503, detail=_AA_UNAVAILABLE)
    raise HTTPException(status_code=501, detail="AA_ENABLED is set but no aggregator client is wired up.")


# ─── 5. Execution engine ────────────────────────────────────────────────────
#
# NOT IMPLEMENTED. This previously returned {"status": "EXECUTED", ...} and told
# the user "Bought 10x HAL" — for an order that was never placed. Reporting a
# fake fill to someone who believes they now hold a position is the worst
# failure mode in this codebase. It stays off until a real broker API is wired
# in behind a real, authenticated, consented order flow.

EXECUTION_ENABLED = os.environ.get("EXECUTION_ENABLED", "0") == "1"


@app.post("/api/execution/order", tags=["Execution"])
async def execute_protected_order(order: OrderRequest):
    """Order placement. Disabled until a real broker integration exists."""
    if not EXECUTION_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Ants doesn't place trades. Take this to your broker.",
        )
    raise HTTPException(status_code=501, detail="EXECUTION_ENABLED is set but no broker client is wired up.")


# ─── 6. Swarm Radar (WebSocket) ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)


manager = ConnectionManager()


SWARM_RADAR_ENABLED = os.environ.get("SWARM_RADAR_ENABLED", "0") == "1"


@app.websocket("/ws/swarm-radar")
async def swarm_radar(ws: WebSocket):
    """Momentum feed. Disabled — there is no real order-flow source behind it.

    This used to emit random.choice(sectors) / random.uniform(1.5, 4.5) /
    random.randint(400, 1200) every 3 seconds, and the UI rendered it under a
    pulsing "LIVE" badge with a buy button next to it: invented volume spikes
    and invented crowd sizes driving real money decisions. Closing the socket
    is the only honest behaviour until aggregated order flow actually exists.
    """
    if not SWARM_RADAR_ENABLED:
        await ws.close(code=1011, reason="Swarm Radar has no live data source.")
        return

    await manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(3)
            # TODO: publish real aggregated, anonymised order flow here.
            raise NotImplementedError("No live momentum source is wired up.")
    except (WebSocketDisconnect, NotImplementedError):
        manager.disconnect(ws)


# ─── 6b. Index benchmarks (live) ────────────────────────────────────────────

@app.get("/api/benchmarks", tags=["Analysis"])
def index_benchmarks():
    """Trailing 1-year returns for Nifty 50 / Sensex / Nifty Midcap 150.

    Replaces a hardcoded frontend table whose Nifty figure had the wrong sign.
    Returns available:false rather than a placeholder when the fetch fails.
    """
    return benchmarks.get_benchmarks()


@app.get("/api/rank", tags=["Analysis"])
async def get_rank(returnPct: float):
    """Where this return sits against every other anonymous analysis run
    through this app — a real cohort percentile, not an invented one.

    available:false until database.Database.MIN_COHORT_SIZE real samples
    exist. Requires SUPABASE_URL + SUPABASE_KEY; without them this always
    returns available:false rather than fabricating a percentile.
    """
    return await database.db.get_percentile_rank(returnPct)


# ─── 7. Authentication ──────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    user_id: str
    email: str


# Accounts require a real user store. Without Supabase configured, signup
# minted a token for anyone and login accepted ANY password for ANY email —
# an open door to every /api/portfolios endpoint. The whole surface is gated
# on a configured backing store rather than shipped in mock form.
def _require_account_store() -> None:
    if database.db.client is None:
        raise HTTPException(
            status_code=503,
            detail="Accounts aren't enabled on this deployment. Set SUPABASE_URL and SUPABASE_KEY.",
        )


@app.post("/api/auth/signup", tags=["Auth"], response_model=TokenResponse)
async def signup(payload: SignupRequest):
    """Create a new user account.

    Password policy, hashing, duplicate detection and token minting all live in
    auth.signup_user — one code path owns credentials.
    """
    _require_account_store()
    try:
        return await auth.signup_user(database.db, payload.email, payload.password, payload.name)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    except ValueError as exc:
        # The store rejected the insert (unique-constraint race, RLS denial).
        # Don't echo the driver's message — it can name tables and columns.
        raise HTTPException(status_code=409, detail="Couldn't create that account. Try logging in.") from exc


@app.post("/api/auth/login", tags=["Auth"], response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Log in to an existing account.

    The token carries the user_id that _verify_portfolio_ownership and every
    /api/portfolios* query filter on, so a session only ever reaches its own
    rows. A wrong password and an unknown email return the same 401 — see
    auth.login_user.
    """
    _require_account_store()
    try:
        return await auth.login_user(database.db, payload.email, payload.password)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)


@app.get("/api/auth/profile", tags=["Auth"])
async def get_profile(current_user: dict = Depends(auth.get_current_user)):
    """Get current user's profile.

    created_at used to be datetime.now() — a fresh, fabricated "account created"
    timestamp on every single request. The JWT carries no such claim, so the
    honest answer is the stored one, or nothing.
    """
    user_id = current_user.get("user_id")
    created_at = None
    try:
        stored = await database.db.get_user(user_id)
        if stored:
            created_at = stored.get("created_at")
    except Exception:
        created_at = None

    return {
        "user_id": user_id,
        "email": current_user.get("email"),
        "created_at": created_at,
    }


# ─── 8. Portfolio Management ────────────────────────────────────────────────

class PortfolioRequest(BaseModel):
    name: str
    description: Optional[str] = None


@app.post("/api/portfolios", tags=["Portfolio"])
async def create_portfolio(payload: PortfolioRequest, current_user: dict = Depends(auth.get_current_user)):
    """Create a new portfolio."""
    user_id = current_user.get("user_id")
    portfolio = await database.db.create_portfolio(user_id, payload.name, payload.description or "")
    return _written(portfolio, "portfolio")


@app.get("/api/portfolios", tags=["Portfolio"])
async def list_portfolios(current_user: dict = Depends(auth.get_current_user)):
    """List all portfolios for user."""
    user_id = current_user.get("user_id")
    portfolios = await database.db.get_portfolios(user_id)
    return portfolios


# ─── 9. CSV Import ──────────────────────────────────────────────────────────

@app.post("/api/portfolios/import-csv", tags=["Portfolio"])
async def import_csv_portfolio(
    portfolio_name: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """Upload CSV file with holdings → auto-create portfolio + holdings."""
    user_id = current_user.get("user_id")

    # This had no size limit at all — `(await file.read()).decode()` on an
    # arbitrary body, so a large upload was an unauthenticated-adjacent OOM.
    raw = await _read_capped(file, MAX_CSV_BYTES, "CSV over 2MB — split it or trim unused columns.")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="That file isn't UTF-8 text. Re-export it as CSV from your broker or spreadsheet.",
        )

    # Parse CSV
    holdings, messages = csv_to_holdings(content)

    if not holdings:
        raise HTTPException(status_code=422, detail=f"No valid holdings: {messages}")

    # create_portfolio returns None when the insert comes back empty (an RLS
    # denial, for instance). Subscripting that raised TypeError and surfaced as
    # an unhandled 500 with a stack trace instead of a usable message.
    portfolio = await database.db.create_portfolio(
        user_id, portfolio_name, f"Imported from CSV ({datetime.now().strftime('%Y-%m-%d')})"
    )
    if not portfolio or not portfolio.get("id"):
        raise HTTPException(status_code=502, detail="Couldn't create the portfolio. Try again.")

    # Supabase gives us no transaction here, so a failure partway through used to
    # leave a half-populated portfolio behind AND return a 500 — the user saw an
    # error but got a portfolio silently missing rows. Roll our own: delete the
    # portfolio we just made, so the import is all-or-nothing from outside.
    try:
        for h in holdings:
            await database.db.add_holding(
                portfolio["id"],
                h["ticker"],
                h["qty"],
                h["buy_price"],
                h["sector"],
            )
    except Exception:
        try:
            await database.db.delete_portfolio(portfolio["id"])
        except Exception:
            # Cleanup failed too — say so rather than implying nothing was written.
            raise HTTPException(
                status_code=502,
                detail=(
                    f"The import failed partway through and the incomplete portfolio "
                    f"'{portfolio_name}' could not be removed. Delete it manually before retrying."
                ),
            )
        raise HTTPException(status_code=502, detail="Couldn't import all holdings — nothing was saved. Try again.")

    return {
        "portfolio_id": portfolio["id"],
        "portfolio_name": portfolio["name"],
        "holdings_count": len(holdings),
        "holdings": holdings,
        "warnings": messages,
    }


# ─── 10. Holdings Management ────────────────────────────────────────────────

@app.post("/api/portfolios/{portfolio_id}/holdings", tags=["Holdings"])
async def add_holding(
    portfolio_id: str,
    payload: database.HoldingCreate,
    current_user: dict = Depends(auth.get_current_user),
):
    """Add a holding to a portfolio."""
    user_id = current_user.get("user_id")
    await _verify_portfolio_ownership(portfolio_id, user_id)

    if payload.qty <= 0 or payload.buy_price <= 0:
        raise HTTPException(status_code=400, detail="Quantity and buy price must be positive")

    holding = await database.db.add_holding(
        portfolio_id,
        payload.ticker,
        payload.qty,
        payload.buy_price,
        payload.sector,
    )
    return _written(holding, "holding")


async def _verify_portfolio_ownership(portfolio_id: str, user_id: str):
    """Verify that user owns the portfolio. Raises 403 if not."""
    portfolio = await database.db.get_portfolio(portfolio_id)
    if not portfolio or portfolio.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied. Portfolio not found or not owned by you.")
    return portfolio


@app.get("/api/portfolios/{portfolio_id}/holdings", tags=["Holdings"])
async def get_holdings(portfolio_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Get all holdings in a portfolio."""
    user_id = current_user.get("user_id")
    await _verify_portfolio_ownership(portfolio_id, user_id)
    holdings = await database.db.get_holdings(portfolio_id)
    return holdings


# ─── 11. Portfolio Analysis (with real prices) ──────────────────────────────

@app.get("/api/portfolios/{portfolio_id}/analysis", tags=["Analysis"])
async def analyze_portfolio_live(portfolio_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Analyze portfolio with live prices."""
    user_id = current_user.get("user_id")
    await _verify_portfolio_ownership(portfolio_id, user_id)
    holdings = await database.db.get_holdings(portfolio_id)

    if not holdings:
        # Was a 200 carrying {"error": ...}, which every HTTP client treats as
        # success — the frontend would try to read .holdings off it.
        raise HTTPException(status_code=404, detail="No holdings in this portfolio yet.")

    # Run through the analysis engine. `prices.get_portfolio_metrics` used to be
    # merged over the top of this via {**analysis, **metrics_data}; both dicts
    # carry a "holdings" key, so prices.py's version WON and silently discarded
    # weightPct, returnPct, priceSource and known — the very fields the UI needs
    # to hedge an unpriced holding. prices.py also reports a failed lookup as a
    # real 0% return with no flag at all, so the overwrite replaced honest data
    # with fabricated data. The engine is the single source of truth here.
    try:
        analysis = engine.analyze(
            [
                {
                    "ticker": h["ticker"],
                    "qty": h["qty"],
                    "avg": h["buy_price"],
                }
                for h in holdings
            ],
            source="portfolio",
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        # Don't hand the client an internal exception string with a 200 status.
        raise HTTPException(
            status_code=500, detail="Couldn't analyze this portfolio. Try again in a moment."
        )

    return analysis


# ─── 12. Gamification ───────────────────────────────────────────────────────

# The largest single award the client can legitimately report (Daily Ace bonus
# plus a generous streak multiplier). xp_earned was an unbounded signed int the
# server passed straight through, so xp_earned=10**9 jumped to level 100 and a
# negative value could quietly erase progress.
MAX_XP_PER_AWARD = 200


class XPRequest(BaseModel):
    xp_earned: int = Field(..., gt=0, le=MAX_XP_PER_AWARD)


@app.post("/api/gamification/xp", tags=["Gamification"])
async def earn_xp(payload: XPRequest, current_user: dict = Depends(auth.get_current_user)):
    """Award XP to user."""
    user_id = current_user.get("user_id")
    result = await database.db.update_xp(user_id, payload.xp_earned)
    return _written(result, "XP update")


@app.get("/api/gamification/state", tags=["Gamification"])
async def get_gamification_state(current_user: dict = Depends(auth.get_current_user)):
    """Get user's gamification progress."""
    user_id = current_user.get("user_id")
    state = await database.db.get_gamification_state(user_id)
    return state


class AchievementRequest(BaseModel):
    achievement_id: str


@app.post("/api/gamification/achievements/{achievement_id}", tags=["Gamification"])
async def unlock_achievement(
    achievement_id: str,
    current_user: dict = Depends(auth.get_current_user),
):
    """Unlock an achievement."""
    user_id = current_user.get("user_id")
    result = await database.db.add_achievement(user_id, achievement_id)
    return _written(result, "achievement")


# ─── 13. Watchlist ──────────────────────────────────────────────────────────

@app.post("/api/watchlist", tags=["Watchlist"])
async def add_to_watchlist(
    ticker: str,
    fit_score: int = 0,
    current_user: dict = Depends(auth.get_current_user),
):
    """Add stock to watchlist."""
    user_id = current_user.get("user_id")
    item = await database.db.add_watchlist_item(user_id, ticker, fit_score)
    return item


@app.get("/api/watchlist", tags=["Watchlist"])
async def get_watchlist(current_user: dict = Depends(auth.get_current_user)):
    """Get user's watchlist."""
    user_id = current_user.get("user_id")
    items = await database.db.get_watchlist(user_id)
    return items


# ─── 14. Price Alerts ───────────────────────────────────────────────────────

@app.post("/api/price-alerts", tags=["Alerts"])
async def create_price_alert(
    ticker: str,
    buy_target: Optional[float] = None,
    sell_target: Optional[float] = None,
    current_user: dict = Depends(auth.get_current_user),
):
    """Create a price alert for a stock."""
    user_id = current_user.get("user_id")
    alert = await database.db.add_price_alert(user_id, ticker, buy_target, sell_target)
    return alert


@app.get("/api/price-alerts", tags=["Alerts"])
async def get_price_alerts(current_user: dict = Depends(auth.get_current_user)):
    """Get user's active price alerts."""
    user_id = current_user.get("user_id")
    alerts = await database.db.get_price_alerts(user_id)
    return alerts


# ─── 15. Stock Prices (Real-time) ────────────────────────────────────────────

@app.get("/api/prices/{ticker}", tags=["Prices"])
def get_stock_price(ticker: str):
    """Get current price for a stock."""
    price_data = prices.get_stock_price(ticker)
    if not price_data:
        raise HTTPException(status_code=404, detail=f"Could not fetch price for {ticker}")
    return price_data


@app.post("/api/prices/batch", tags=["Prices"])
def get_batch_prices(tickers: List[str]):
    """Get prices for multiple stocks."""
    return prices.get_stock_prices(tickers)
