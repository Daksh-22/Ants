"""
Authentication — JWT tokens, user sessions, password validation.

For MVP: Simple JWT-based auth. Production: Migrate to Supabase Auth.
"""

import jwt
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET environment variable is required. Set it before running the app.")
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


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Extract and verify user from Authorization header."""
    token = credentials.credentials
    return verify_token(token)


# bcrypt silently truncates at 72 BYTES. Left unchecked, a 200-character
# passphrase is only ever verified on its first 72 bytes — so two different long
# passwords sharing a prefix both unlock the account. Reject instead of
# truncating, and measure in bytes because a UTF-8 emoji costs four of them.
BCRYPT_MAX_BYTES = 72


def validate_password(password: str) -> tuple[bool, str]:
    """Password policy. Returns (ok, reason-if-not)."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        return False, f"Password must be at most {BCRYPT_MAX_BYTES} bytes"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    return True, ""


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash. False on any malformed hash.

    A stored hash can be absent or corrupt — a row migrated before the column
    existed, for instance. bcrypt raises on those, and an uncaught raise inside a
    login handler is a 500 that tells an attacker the account exists.
    """
    import bcrypt
    if not password or not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


# ─── Account flows ──────────────────────────────────────────────────────────
#
# These own the whole credential path: policy, hashing, lookup, verification and
# token minting. The endpoints in main.py just call them, so there is exactly one
# place where a password is checked and exactly one place a token is issued.


class AuthError(Exception):
    """Auth failure carrying the HTTP status the endpoint should return."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def signup_user(db, email: str, password: str, name: Optional[str] = None) -> dict:
    """Register a new account and return a token payload."""
    email = db.normalize_email(email)
    if "@" not in email or "." not in email.split("@")[-1]:
        raise AuthError(400, "Enter a valid email address.")

    ok, reason = validate_password(password)
    if not ok:
        raise AuthError(400, reason)

    existing = await db.get_user_by_email(email)
    if existing:
        raise AuthError(409, "That email is already registered. Try logging in.")

    user = await db.create_user(email, hash_password(password), name)
    if not user or not user.get("id"):
        raise AuthError(502, "Couldn't create the account. Try again.")

    return {
        "access_token": create_access_token(str(user["id"]), email),
        "user_id": str(user["id"]),
        "email": email,
    }


async def login_user(db, email: str, password: str) -> dict:
    """Verify credentials and return a token payload.

    Both "no such account" and "wrong password" return the SAME 401 with the same
    message. Distinguishing them turns the login form into an account-existence
    oracle, which is how credential-stuffing lists get validated.
    """
    email = db.normalize_email(email)
    user = await db.get_user_by_email(email)

    if not user or not verify_password(password, user.get("password_hash") or ""):
        raise AuthError(401, "Email or password is incorrect.")

    return {
        "access_token": create_access_token(str(user["id"]), email),
        "user_id": str(user["id"]),
        "email": email,
    }
