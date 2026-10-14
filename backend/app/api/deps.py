"""Shared API dependencies: optional bearer-token protection (for use beyond localhost)."""
from __future__ import annotations

import hmac

from fastapi import Header, Query, Request

from app.core.config import get_settings
from app.core.errors import AppError


def token_ok(supplied: str | None) -> bool:
    expected = get_settings().api_token
    if not expected:
        return True
    return bool(supplied) and hmac.compare_digest(supplied, expected)


def require_token(
    request: Request,
    authorization: str | None = Header(None),
    token: str | None = Query(None),
) -> None:
    """If VISIONLAB_API_TOKEN is set every API call needs ``Authorization: Bearer <token>`` or ``?token=``
    (the query form exists for <img> tags and WebSockets, which cannot set headers)."""
    supplied = token
    if authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not token_ok(supplied):
        raise AppError(401, "UNAUTHORIZED", "Thiếu hoặc sai API token.")
