"""
api/auth.py
-----------
Validates Supabase JWTs on every protected API request.

Supabase issues standard HS256 JWTs signed with the project's JWT secret.
We validate the token locally — no network call to Supabase per request.

Usage:
    from api.auth import get_current_user

    @app.post("/query")
    def query(req: QueryRequest, user=Depends(get_current_user)):
        ...
"""

from __future__ import annotations

import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
ALGORITHM = "HS256"

# FastAPI security scheme — extracts Bearer token from Authorization header
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    Dependency — validates the Bearer JWT and returns the decoded payload.
    Raises 401 if the token is missing, expired, or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server auth configuration error. SUPABASE_JWT_SECRET not set.",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            audience="authenticated",   # Supabase sets aud = "authenticated"
        )
        return payload

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_user_id(user: dict = Depends(get_current_user)) -> str:
    """Convenience dependency — returns just the user's UUID."""
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing user ID.")
    return uid
