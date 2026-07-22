from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.files import router as files_router
from app.api.projects import router as projects_router
from app.api.runs import router as runs_router
from app.api.global_runs import router as global_runs_router
from app.api.tasks import router as tasks_router
from app.config import Settings
from app.services.cleanup import run_cleanup


async def _cleanup_loop(settings: Settings) -> None:
    """Background task that runs cleanup on a configurable interval (Stage E)."""
    while settings.cleanup_enabled:
        await asyncio.sleep(settings.cleanup_cron_interval_minutes * 60)
        try:
            run_cleanup(settings)
        except Exception:
            pass  # cleanup must never crash the app


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
        cleanup_task = asyncio.create_task(_cleanup_loop(runtime_settings))
        yield
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

    app = FastAPI(title="ProjectPack Office Agent", version="0.1.0", lifespan=lifespan)
    app.state.settings = runtime_settings
    app.state.model_health_transport = model_health_transport
    app.include_router(health_router)
    app.include_router(projects_router)
    app.include_router(files_router)
    app.include_router(runs_router)
    app.include_router(global_runs_router)
    app.include_router(tasks_router)
    return app


app = create_app()
