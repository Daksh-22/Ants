"""
Ants backend — FastAPI service powering the Ants frontend.

    uvicorn main:app --reload --port 8000        (from backend/)

Domains:
  1. Portfolio analysis  — real math (engine.py) + optional Claude polish (ai.py)
  2. Screenshot OCR      — Claude vision → holdings → analysis
  3. Ask Ants            — RAG-grounded chat (rag.py + ai.py)
  4. Account Aggregator  — consent-flow mock (swap for Setu/Finvu sandbox)
  5. Execution engine    — order mock with auto trailing stop-loss
  6. Swarm Radar         — live momentum WebSocket feed

Env: ANTHROPIC_API_KEY (optional — enables AI), ANTHROPIC_MODEL,
     ALLOWED_ORIGINS (comma-separated, for the deployed frontend), PORT.
"""

from __future__ import annotations

import asyncio
import base64
import os
import random
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import ai
import engine
import rag

app = FastAPI(
    title="Ants Backend",
    description="Honest portfolio breakdowns for Indian Gen Z — analysis, AI, RAG, AA, execution.",
    version="2.0.0",
)

_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
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


class AnalyzeRequest(BaseModel):
    positions: List[Position]
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


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["Ops"])
async def healthz():
    return {"status": "ok", "aiEnabled": ai.have_ai(), "knowledgeChunks": rag.chunk_count()}


# ─── 1. Portfolio analysis ───────────────────────────────────────────────────

@app.post("/api/analyze", tags=["Analysis"])
async def analyze_portfolio(payload: AnalyzeRequest):
    """Positions → full Analysis (engine math, AI-polished copy when available)."""
    try:
        analysis = engine.analyze([p.model_dump() for p in payload.positions], source=payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return ai.polish_analysis(analysis)


@app.get("/api/analyze/demo", tags=["Analysis"])
async def analyze_demo(source: str = "demo"):
    """The Arjun Mehta demo portfolio through the same real engine."""
    return engine.demo_analysis(source=source)


class CheckRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=40)
    positions: List[Position]


@app.post("/api/check", tags=["Analysis"])
async def check_tip(payload: CheckRequest):
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
    Without an API key (or an unreadable image) returns the demo analysis,
    flagged with aiUsed=false so the frontend can say so honestly."""
    if file.content_type not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
        raise HTTPException(status_code=415, detail="Upload a PNG/JPEG/WebP screenshot.")
    raw = await file.read()
    if len(raw) > 8_000_000:
        raise HTTPException(status_code=413, detail="Image over 8MB — crop to the holdings list.")

    holdings = ai.extract_holdings(base64.standard_b64encode(raw).decode(), file.content_type)
    if holdings:
        try:
            analysis = engine.analyze(holdings, source="screenshot")
            return {**ai.polish_analysis(analysis), "aiUsed": True}
        except ValueError:
            pass
    return {**engine.demo_analysis(source="screenshot"), "aiUsed": False,
            "note": "Couldn't read the screenshot (AI OCR unavailable) — showing the demo analysis."}


# ─── 3. Ask Ants (RAG chat) ─────────────────────────────────────────────────

@app.post("/api/chat", tags=["AI"])
async def ask_ants(payload: ChatRequest):
    return ai.chat(payload.question, payload.analysis)


@app.get("/api/rag/search", tags=["AI"])
async def rag_search(q: str, k: int = 4):
    return {"query": q, "results": rag.retrieve(q, k=min(k, 10))}


# ─── 4. Account Aggregator (mock — swap for Setu/Finvu sandbox) ─────────────

@app.post("/api/aa/initiate-sync", tags=["Account Aggregator"])
async def initiate_aa_sync(payload: AASyncRequest):
    """Step 1: FIU requests consent. Production: Setu/Moneyone sandbox call."""
    await asyncio.sleep(1.2)
    return {
        "status": "success",
        "message": "Consent request generated successfully.",
        "redirectUrl": f"https://sandbox.setu.co/aa/consent/mock_req_{payload.mobile}",
        "consentHandle": f"cons_{random.randint(10000, 99999)}",
    }


@app.post("/api/aa/webhook", tags=["Account Aggregator"])
async def aa_data_ready_webhook(consentHandle: str):
    """Step 2: consent approved → decrypted FIP holdings → real analysis."""
    return {"status": "DATA_READY", "analysis": engine.demo_analysis(source="broker")}


# ─── 5. Execution engine (mock — swap for Angel One SmartAPI) ───────────────

@app.post("/api/execution/order", tags=["Execution"])
async def execute_protected_order(order: OrderRequest):
    """Places a (mock) order with a mandatory 8% trailing stop-loss bundled."""
    transaction_id = f"ANGEL_{random.randint(100000, 999999)}"
    tsl_trigger_price = round(order.price * 0.92, 2)
    return {
        "status": "EXECUTED",
        "primary_order_id": transaction_id,
        "symbol": order.symbol,
        "execution_price": order.price,
        "risk_management": {
            "strategy": "Trailing Stop-Loss",
            "initial_trigger_price": tsl_trigger_price,
            "max_drawdown_allowed": "8.0%",
        },
        "message": f"Bought {order.qty}x {order.symbol}. Downside capped at {tsl_trigger_price}.",
    }


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


@app.websocket("/ws/swarm-radar")
async def swarm_radar(ws: WebSocket):
    """Streams simulated momentum breakouts (production: aggregated order flow)."""
    await manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(3)
            sectors = ["AI Infra", "Defense", "Power", "EMS", "Railways"]
            payload = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event": "MOMENTUM_SPIKE",
                "data": {
                    "sector": random.choice(sectors),
                    "volume_multiplier": round(random.uniform(1.5, 4.5), 2),
                    "ants_accumulating": random.randint(400, 1200),
                    "technical_context": "VCP breakout detected on the 15m timeframe.",
                },
            }
            await ws.send_json(payload)
    except WebSocketDisconnect:
        manager.disconnect(ws)
