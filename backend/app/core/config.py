from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@127.0.0.1:5432/roro_fleet"
    session_cookie_name: str = "roro_session"
    session_days: int = 14
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5181"
    groq_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
