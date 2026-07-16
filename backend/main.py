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

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import ai
import engine
import metrics
import rag
import auth
import database
import prices
from csv_importer import csv_to_holdings

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


@app.post("/api/metrics", tags=["Analysis"])
async def portfolio_metrics(payload: AnalyzeRequest):
    """Positions → risk metrics: volatility, Sharpe, est. max drawdown, beta,
    composite risk score, plus per-holding risk contributions."""
    try:
        analysis = engine.analyze([p.model_dump() for p in payload.positions], source=payload.source)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    risk = metrics.calculate_metrics(analysis["holdings"], analysis["summary"]["returnsPct"])
    contributions = metrics.get_holding_volatilities(analysis["holdings"])
    return {
        "risk": risk.__dict__,
        "holdingVolatilities": [c.__dict__ for c in contributions],
    }


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


@app.post("/api/auth/signup", tags=["Auth"], response_model=TokenResponse)
async def signup(payload: SignupRequest):
    """Create a new user account."""
    valid, msg = auth.validate_password(payload.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # For MVP: mock user creation. Production: call Supabase Auth.
    user_id = f"user_{random.randint(100000, 999999)}"
    token = auth.create_access_token(user_id, payload.email)

    return {"access_token": token, "user_id": user_id, "email": payload.email}


@app.post("/api/auth/login", tags=["Auth"], response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Login to existing account."""
    # For MVP: mock login. Production: verify against Supabase Auth.
    user_id = f"user_{random.randint(100000, 999999)}"
    token = auth.create_access_token(user_id, payload.email)

    return {"access_token": token, "user_id": user_id, "email": payload.email}


@app.get("/api/auth/profile", tags=["Auth"])
async def get_profile(current_user: dict = Depends(auth.get_current_user)):
    """Get current user's profile."""
    return {
        "user_id": current_user.get("user_id"),
        "email": current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
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
    return portfolio


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

    # Read CSV
    try:
        content = (await file.read()).decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Parse CSV
    holdings, messages = csv_to_holdings(content)

    if not holdings:
        raise HTTPException(status_code=422, detail=f"No valid holdings: {messages}")

    # Create portfolio
    portfolio = await database.db.create_portfolio(user_id, portfolio_name, f"Imported from CSV ({datetime.now().strftime('%Y-%m-%d')})")

    # Add holdings
    for h in holdings:
        await database.db.add_holding(
            portfolio["id"],
            h["ticker"],
            h["qty"],
            h["buy_price"],
            h["sector"],
        )

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
    holding = await database.db.add_holding(
        portfolio_id,
        payload.ticker,
        payload.qty,
        payload.buy_price,
        payload.sector,
    )
    return holding


@app.get("/api/portfolios/{portfolio_id}/holdings", tags=["Holdings"])
async def get_holdings(portfolio_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Get all holdings in a portfolio."""
    holdings = await database.db.get_holdings(portfolio_id)
    return holdings


# ─── 11. Portfolio Analysis (with real prices) ──────────────────────────────

@app.get("/api/portfolios/{portfolio_id}/analysis", tags=["Analysis"])
async def analyze_portfolio_live(portfolio_id: str, current_user: dict = Depends(auth.get_current_user)):
    """Analyze portfolio with live prices."""
    holdings = await database.db.get_holdings(portfolio_id)

    if not holdings:
        return {"error": "No holdings in portfolio"}

    # Fetch current prices and calculate metrics
    metrics_data = prices.get_portfolio_metrics(holdings)

    # Run through analysis engine
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

        return {**analysis, **metrics_data}

    except Exception as e:
        return {"error": str(e), "metrics": metrics_data}


# ─── 12. Gamification ───────────────────────────────────────────────────────

class XPRequest(BaseModel):
    xp_earned: int


@app.post("/api/gamification/xp", tags=["Gamification"])
async def earn_xp(payload: XPRequest, current_user: dict = Depends(auth.get_current_user)):
    """Award XP to user."""
    user_id = current_user.get("user_id")
    result = await database.db.update_xp(user_id, payload.xp_earned)
    return result


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
    return result


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
async def get_stock_price(ticker: str):
    """Get current price for a stock."""
    price_data = prices.get_stock_price(ticker)
    if not price_data:
        raise HTTPException(status_code=404, detail=f"Could not fetch price for {ticker}")
    return price_data


@app.post("/api/prices/batch", tags=["Prices"])
async def get_batch_prices(tickers: List[str]):
    """Get prices for multiple stocks."""
    return prices.get_stock_prices(tickers)
