"""FastAPI application factory."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import dataset, experiments, inference, system, training
from app.api.deps import require_token
from app.core.config import get_settings
from app.core.db import init_db
from app.core.errors import install_error_handlers
from app.services.training_service import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.ensure_dirs()
    init_db()
    manager.attach_loop(asyncio.get_running_loop())
    manager.recover_orphans()
    yield
    manager.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Vision Lab AI", version="1.0.0", lifespan=lifespan,
        description="Local-first computer-vision training laboratory for students.",
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False,
        allow_methods=["*"], allow_headers=["*"],
    )
    install_error_handlers(app)

    api = APIRouter(prefix="/api")
    api.include_router(system.public_router)  # /api/health stays open for liveness checks
    protected = APIRouter(dependencies=[Depends(require_token)])
    for r in (dataset.router, training.router, experiments.router, inference.router, system.router):
        protected.include_router(r)
    api.include_router(protected)
    app.include_router(api)
    app.include_router(training.ws_router)  # token is checked inside the WS handler

    dist = settings.frontend_dist
    if dist.is_dir() and (dist / "index.html").is_file():  # optional single-process production mode
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str):
            candidate = (dist / full_path).resolve()
            if full_path and dist.resolve() in candidate.parents and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


app = create_app()
