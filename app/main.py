from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.config import Settings


def create_app(
    settings: Settings | None = None,
    *,
    model_health_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    runtime_settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        for directory in runtime_settings.required_directories():
            directory.mkdir(parents=True, exist_ok=True)
        yield

    app = FastAPI(title="ProjectPack Office Agent", version="0.1.0", lifespan=lifespan)
    app.state.settings = runtime_settings
    app.state.model_health_transport = model_health_transport
    app.include_router(health_router)
    app.include_router(projects_router)
    return app


app = create_app()
