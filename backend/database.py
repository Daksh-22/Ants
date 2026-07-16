"""
Database layer — Supabase PostgreSQL models and CRUD operations.

Tables:
  - users: auth + profiles
  - portfolios: user's portfolio (can have multiple)
  - holdings: individual stocks in a portfolio
  - gamification: XP, level, achievements, streaks per user
  - watchlist: stocks user is researching
  - price_alerts: buy/sell targets
  - price_snapshots: daily price cache (for fast analytics)
"""

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
import os
import json

# Initialize Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
    supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None
except ImportError:
    supabase = None


# ─── Pydantic Models (for API validation) ────────────────────────────────────

class UserCreate(BaseModel):
    """New user registration."""
    email: str
    password: str


class UserProfile(BaseModel):
    """User profile."""
    id: str
    email: str
    name: Optional[str] = None
    created_at: str


class PortfolioCreate(BaseModel):
    """Create a new portfolio."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class HoldingCreate(BaseModel):
    """Add a holding to a portfolio."""
    ticker: str = Field(..., min_length=1, max_length=10)
    qty: float = Field(..., gt=0)
    buy_price: float = Field(..., gt=0)
    sector: str = Field(..., min_length=1, max_length=50)


class GamificationState(BaseModel):
    """User's gamification progress."""
    user_id: str
    xp: int = 0
    level: int = 1
    streak_count: int = 0
    last_check_in: Optional[str] = None
    achievements: List[str] = []
    created_at: str
    updated_at: str


class WatchlistItem(BaseModel):
    """Stock on user's watchlist."""
    user_id: str
    ticker: str
    fit_score: int = 0
    added_at: str


class PriceAlert(BaseModel):
    """Price target alert."""
    user_id: str
    ticker: str
    buy_target: Optional[float] = None
    sell_target: Optional[float] = None
    status: str = "active"  # active | triggered
    created_at: str


# ─── Database Operations ──────────────────────────────────────────────────────

class Database:
    """Supabase abstraction layer."""

    def __init__(self, client: Optional[Client]):
        self.client = client

    async def create_user(self, email: str) -> dict:
        """Create user record (Supabase Auth handles password)."""
        if not self.client:
            return {"id": "mock_user", "email": email, "created_at": datetime.now(timezone.utc).isoformat()}

        try:
            result = self.client.table("users").insert({
                "email": email,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            raise ValueError(f"Failed to create user: {str(e)}")

    async def get_user(self, user_id: str) -> Optional[dict]:
        """Get user profile."""
        if not self.client:
            return {"id": user_id, "email": "demo@ants.app"}

        result = self.client.table("users").select("*").eq("id", user_id).execute()
        return result.data[0] if result.data else None

    async def create_portfolio(self, user_id: str, name: str, description: str = "") -> dict:
        """Create a new portfolio for user."""
        if not self.client:
            return {
                "id": "portfolio_1",
                "user_id": user_id,
                "name": name,
                "description": description,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        result = self.client.table("portfolios").insert({
            "user_id": user_id,
            "name": name,
            "description": description,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return result.data[0] if result.data else None

    async def get_portfolios(self, user_id: str) -> List[dict]:
        """Get all portfolios for a user."""
        if not self.client:
            return []

        result = self.client.table("portfolios").select("*").eq("user_id", user_id).execute()
        return result.data if result.data else []

    async def add_holding(self, portfolio_id: str, ticker: str, qty: float, buy_price: float, sector: str) -> dict:
        """Add a holding to portfolio."""
        if not self.client:
            return {
                "id": "holding_1",
                "portfolio_id": portfolio_id,
                "ticker": ticker,
                "qty": qty,
                "buy_price": buy_price,
                "sector": sector,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        result = self.client.table("holdings").insert({
            "portfolio_id": portfolio_id,
            "ticker": ticker,
            "qty": qty,
            "buy_price": buy_price,
            "sector": sector,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return result.data[0] if result.data else None

    async def get_holdings(self, portfolio_id: str) -> List[dict]:
        """Get all holdings in a portfolio."""
        if not self.client:
            return []

        result = self.client.table("holdings").select("*").eq("portfolio_id", portfolio_id).execute()
        return result.data if result.data else []

    async def get_gamification_state(self, user_id: str) -> Optional[dict]:
        """Get user's gamification progress."""
        if not self.client:
            return {
                "user_id": user_id,
                "xp": 0,
                "level": 1,
                "streak_count": 0,
                "achievements": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

        result = self.client.table("gamification").select("*").eq("user_id", user_id).execute()
        return result.data[0] if result.data else None

    async def update_xp(self, user_id: str, xp_earned: int) -> dict:
        """Add XP to user (recalculate level)."""
        if not self.client:
            return {"xp": xp_earned, "level": 1}

        current = await self.get_gamification_state(user_id)
        if not current:
            current = {
                "user_id": user_id,
                "xp": 0,
                "level": 1,
                "streak_count": 0,
                "achievements": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        total_xp = current.get("xp", 0) + xp_earned
        # Level bands (simplified: 1000 XP per 10 levels)
        level = 1 + (total_xp // 1000)

        result = self.client.table("gamification").upsert({
            "user_id": user_id,
            "xp": total_xp % 1000,  # XP in current level
            "level": min(100, level),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **current  # preserve other fields
        }).execute()

        return result.data[0] if result.data else {"xp": total_xp, "level": level}

    async def add_achievement(self, user_id: str, achievement_id: str) -> dict:
        """Unlock an achievement for user."""
        if not self.client:
            return {"achievement_id": achievement_id, "unlocked_at": datetime.now(timezone.utc).isoformat()}

        current = await self.get_gamification_state(user_id)
        achievements = current.get("achievements", []) if current else []

        if achievement_id not in achievements:
            achievements.append(achievement_id)

            result = self.client.table("gamification").upsert({
                "user_id": user_id,
                "achievements": achievements,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                **(current or {})
            }).execute()

            return result.data[0] if result.data else {"achievement_id": achievement_id}

        return {"achievement_id": achievement_id, "already_unlocked": True}

    async def add_watchlist_item(self, user_id: str, ticker: str, fit_score: int = 0) -> dict:
        """Add stock to watchlist."""
        if not self.client:
            return {"user_id": user_id, "ticker": ticker, "fit_score": fit_score}

        result = self.client.table("watchlist").insert({
            "user_id": user_id,
            "ticker": ticker,
            "fit_score": fit_score,
            "added_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return result.data[0] if result.data else None

    async def get_watchlist(self, user_id: str) -> List[dict]:
        """Get user's watchlist."""
        if not self.client:
            return []

        result = self.client.table("watchlist").select("*").eq("user_id", user_id).execute()
        return result.data if result.data else []

    async def add_price_alert(self, user_id: str, ticker: str, buy_target: Optional[float], sell_target: Optional[float]) -> dict:
        """Create a price alert."""
        if not self.client:
            return {"user_id": user_id, "ticker": ticker, "buy_target": buy_target, "sell_target": sell_target}

        result = self.client.table("price_alerts").insert({
            "user_id": user_id,
            "ticker": ticker,
            "buy_target": buy_target,
            "sell_target": sell_target,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return result.data[0] if result.data else None

    async def get_price_alerts(self, user_id: str) -> List[dict]:
        """Get user's active price alerts."""
        if not self.client:
            return []

        result = self.client.table("price_alerts").select("*").eq("user_id", user_id).eq("status", "active").execute()
        return result.data if result.data else []


# Global instance
db = Database(supabase)
