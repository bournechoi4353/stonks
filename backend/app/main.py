"""FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import history, recommend, stocks
from app.api.routes import router
from app.config import settings
from app.services.llm import AIError, AIUnavailableError
from app.services.market_data import MarketDataError, TickerNotFoundError

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,  # no cookies/auth are exchanged
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(stocks.router)
app.include_router(recommend.router)
app.include_router(history.router)


@app.exception_handler(TickerNotFoundError)
def _ticker_not_found(_: Request, exc: TickerNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(MarketDataError)
def _market_data_error(_: Request, exc: MarketDataError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"Upstream market data error: {exc}"})


@app.exception_handler(AIUnavailableError)
def _ai_unavailable(_: Request, exc: AIUnavailableError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": f"AI reasoning unavailable: {exc}"})


@app.exception_handler(AIError)
def _ai_error(_: Request, exc: AIError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"AI reasoning error: {exc}"})


@app.get("/")
def root() -> dict:
    return {"app": settings.app_name, "docs": "/docs"}
