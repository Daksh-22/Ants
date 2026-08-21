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

# ─── Supabase client ────────────────────────────────────────────────────────
# Both credentials must be present AND real. The old check tested only the URL,
# so a key-less config still produced a live client — and once main.py started
# actually loading backend/.env, the placeholder values shipped in .env.example
# ("https://your-project.supabase.co" / "your-anon-key") were enough to make
# /healthz advertise accountsEnabled: true. Every account route then raised on
# first use and returned a 500, which is strictly worse than the honest 503
# _require_account_store() gives when the store is absent.

_PLACEHOLDERS = {
    "",
    "your-anon-key",
    "your-key",
    "your-service-role-key",
    "https://your-project.supabase.co",
    "your-project",
}


def _real(value: str) -> bool:
    """A credential that is present and not one of the documented stand-ins."""
    v = value.strip()
    return bool(v) and v.lower() not in _PLACEHOLDERS


try:
    from supabase import create_client, Client
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
    _configured = _real(SUPABASE_URL) and _real(SUPABASE_KEY)
    supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if _configured else None
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

    @staticmethod
    def normalize_email(email: str) -> str:
        """Emails are case-insensitive in practice; store and match one form.

        Without this, "Alice@x.com" and "alice@x.com" become two accounts and the
        second signup succeeds where the user expects a login.
        """
        return (email or "").strip().lower()

    async def create_user(self, email: str, password_hash: str, name: Optional[str] = None) -> dict:
        """Insert a user with an already-hashed password.

        Takes the HASH, never the password: keeping hashing at the auth layer
        means this module cannot accidentally persist a plaintext credential.
        """
        email = self.normalize_email(email)
        if not self.client:
            return {
                "id": "mock_user",
                "email": email,
                "name": name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        row = {
            "email": email,
            "password_hash": password_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if name:
            row["name"] = name

        try:
            result = self.client.table("users").insert(row).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            raise ValueError(f"Failed to create user: {str(e)}")

    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """Look up a user for login. Returns None when there is no such account."""
        email = self.normalize_email(email)
        if not self.client:
            return None

        result = (
            self.client.table("users").select("*").eq("email", email).limit(1).execute()
        )
        return result.data[0] if result.data else None

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

    async def delete_portfolio(self, portfolio_id: str) -> bool:
        """Delete a portfolio and its holdings. Returns False when there's no store.

        Exists so the CSV import can undo itself: Supabase gives us no
        transaction across the portfolio insert and the per-row holding inserts,
        so a failure partway through would otherwise leave a half-populated
        portfolio behind alongside an error response. Holdings are removed first
        because a foreign key would otherwise block the parent delete.
        """
        if not self.client:
            return False

        self.client.table("holdings").delete().eq("portfolio_id", portfolio_id).execute()
        self.client.table("portfolios").delete().eq("id", portfolio_id).execute()
        return True

    async def get_portfolios(self, user_id: str) -> List[dict]:
        """Get all portfolios for a user."""
        if not self.client:
            return []

        result = self.client.table("portfolios").select("*").eq("user_id", user_id).execute()
        return result.data if result.data else []

    async def get_portfolio(self, portfolio_id: str) -> Optional[dict]:
        """Get a single portfolio by id, including its user_id for ownership checks.

        Returns None when the portfolio doesn't exist. Callers MUST compare
        user_id before returning any holdings — see main._verify_portfolio_ownership.
        """
        if not self.client:
            return None

        result = self.client.table("portfolios").select("*").eq("id", portfolio_id).execute()
        return result.data[0] if result.data else None

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
        # Level bands: 1000 XP per level, capped at 100.
        level = min(100, 1 + (total_xp // 1000))

        # Store LIFETIME xp, not total_xp % 1000 — the modulo threw away every
        # completed level, so a user at 2,400 XP was written back as 400 and
        # lost their progress on the next read.
        # Spread `current` FIRST: it used to come last, which overwrote xp,
        # level and updated_at with the pre-update values, making this a no-op.
        result = self.client.table("gamification").upsert({
            **current,
            "user_id": user_id,
            "xp": total_xp,
            "level": level,
            "updated_at": datetime.now(timezone.utc).isoformat(),
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

            # Same spread-order bug as update_xp: `current` last meant the new
            # achievements list was overwritten by the old one and nothing
            # ever unlocked.
            result = self.client.table("gamification").upsert({
                **(current or {}),
                "user_id": user_id,
                "achievements": achievements,
                "updated_at": datetime.now(timezone.utc).isoformat(),
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
