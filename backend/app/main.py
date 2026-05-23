from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import auth, fleet, integrations, migration, operations
from backend.app.core.config import get_settings


settings = get_settings()

app = FastAPI(title="RORO Fleet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(fleet.router)
app.include_router(integrations.router)
app.include_router(migration.router)
app.include_router(operations.router)


@app.get("/api/health")
def health():
    return {"ok": True}
