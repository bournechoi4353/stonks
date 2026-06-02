"""Application settings, loaded from environment / .env file."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Stonks"
    environment: str = "development"

    # AI reasoning model (Claude Agent SDK / CLI). Opus 4.8 for highest-quality reasoning;
    # recommendations are opt-in in the UI to control subscription usage. Override with AI_MODEL.
    ai_model: str = "claude-opus-4-8"

    # Seed watchlist used the first time the app runs (persisted to data/watchlist.json).
    default_watchlist: str = "AAPL,MSFT,NVDA,GOOGL,AMZN,TSLA"

    # Comma-separated origins allowed to call the API (CORS).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def default_watchlist_list(self) -> list[str]:
        return [s.strip().upper() for s in self.default_watchlist.split(",") if s.strip()]


settings = Settings()
