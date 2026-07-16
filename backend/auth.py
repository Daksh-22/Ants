"""
Authentication — JWT tokens, user sessions, password validation.

For MVP: Simple JWT-based auth. Production: Migrate to Supabase Auth.
"""

import jwt
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthCredentials


SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week


def create_access_token(user_id: str, email: str) -> str:
    """Create JWT token for user."""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# HTTP Bearer auth (for API requests)
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)) -> dict:
    """Extract and verify user from Authorization header."""
    token = credentials.credentials
    return verify_token(token)


def validate_password(password: str) -> tuple[bool, str]:
    """Simple password validation (strengthen in production)."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    return True, ""


def hash_password(password: str) -> str:
    """Hash password (use bcrypt in production)."""
    # For MVP: return a simple placeholder. In production, use bcrypt.
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash."""
    return hash_password(password) == hashed
