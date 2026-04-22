"""
FastAPI application — Python Routing Service for AMC-A*.

Startup: load graph from DB into memory, load ML model.
Background: refresh graph every GRAPH_REFRESH_INTERVAL_SECONDS.
"""
from __future__ import annotations

import sys
import os
import asyncio
import logging

# Add parent directory to path so 'services', 'routers', etc. can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import PYTHON_ROUTING_PORT, GRAPH_REFRESH_INTERVAL_SECONDS, ML_MODEL_PATH
from db import init_pool, close_pool
from services.graph_loader import graph_cache
from services.ml_predictor import init_predictor
from routers.routing import router as routing_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")

# ── Background graph refresh task ─────────────────────────────────────────────
_refresh_task: asyncio.Task | None = None


async def _graph_refresh_loop():
    """Periodically refresh the in-memory graph from DB."""
    while True:
        try:
            await asyncio.sleep(GRAPH_REFRESH_INTERVAL_SECONDS)
            await graph_cache.refresh()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Graph refresh failed: %s", exc, exc_info=True)
            await asyncio.sleep(10)  # retry after short delay


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    global _refresh_task

    # Startup
    logger.info("Starting Python Routing Service on port %d ...", PYTHON_ROUTING_PORT)

    # 1. Connect to DB
    await init_pool()
    logger.info("Database pool initialized.")

    # 2. Load ML model (Phase 3)
    predictor = init_predictor(ML_MODEL_PATH)
    if predictor.is_available():
        logger.info("ML flood prediction model loaded.")
    else:
        logger.info("ML model not available (Phase 3 — not yet trained).")

    # 3. Load graph into memory (first time)
    try:
        snap = await graph_cache.refresh()
        logger.info(
            "Initial graph load: %d nodes, %d edges",
            snap.node_count,
            snap.edge_count,
        )
    except Exception as exc:
        logger.error("Failed to load initial graph: %s", exc, exc_info=True)

    # 4. Start background refresh task (optional)
    if GRAPH_REFRESH_INTERVAL_SECONDS > 0:
        _refresh_task = asyncio.create_task(_graph_refresh_loop())
        logger.info(
            "Background graph refresh every %ds.", GRAPH_REFRESH_INTERVAL_SECONDS
        )
    else:
        logger.info("Background graph refresh disabled (GRAPH_REFRESH_INTERVAL_SECONDS<=0).")

    yield

    # Shutdown
    logger.info("Shutting down Python Routing Service ...")
    if _refresh_task:
        _refresh_task.cancel()
        try:
            await _refresh_task
        except asyncio.CancelledError:
            pass
    await close_pool()
    logger.info("Shutdown complete.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="FloodWatch Python Routing Service",
    description="AMC-A* Bidirectional pathfinding with flood penalty",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS (allow all in dev — restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(routing_router)


@app.get("/health", tags=["system"])
async def health():
    """Health check endpoint."""
    from services.ml_predictor import flood_predictor

    snap = graph_cache.snapshot
    return {
        "status": "ok",
        "graph_loaded": snap is not None and snap.edge_count > 0,
        "nodes": snap.node_count if snap else 0,
        "edges": snap.edge_count if snap else 0,
        "ml_available": flood_predictor.is_available(),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PYTHON_ROUTING_PORT,
        reload=False,
        log_level="info",
    )
