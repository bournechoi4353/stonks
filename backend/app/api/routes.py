"""API routes. Phase 0 exposes health + a hello check to verify the front→back wiring."""
from __future__ import annotations

from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    """Liveness probe."""
    return {"status": "ok"}


@router.get("/hello")
def hello() -> dict:
    """Simple greeting used by the frontend to confirm end-to-end connectivity."""
    return {
        "message": f"Hello from {settings.app_name} backend 👋",
        "environment": settings.environment,
    }
