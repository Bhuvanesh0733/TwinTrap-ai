"""
main.py
=======

TwinTrap AI backend entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000   (from the backend/ directory)

On startup we warm up the in-memory state (generate the simulated data
pool and train an initial model on the balanced dataset) so the first
dashboard load already has a real trained model rather than the
heuristic fallback (see services/state.py::score_live_record).
"""

import sys
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import health, dataset, simulation, models_api, evaluation_api, analysis, explainability, imbalance_api, research_api, mobile
from .services.state import STATE
from .ml.train_pipeline import train_all_models

app = FastAPI(
    title="TwinTrap AI API",
    description="Digital Twin drift detection: industrial simulation + smartphone live twin, ML training, evaluation, and explainability.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allows the phone (arbitrary local-network IP) to reach the WS/REST API for the campus demo
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log full traceback server-side only; never leak it to the client
    # (spec section 24: "Never expose Python stack traces to the frontend").
    traceback.print_exc(file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. See backend server logs for details."},
    )


for router in (health.router, dataset.router, simulation.router, models_api.router,
               evaluation_api.router, analysis.router, explainability.router,
               imbalance_api.router, research_api.router, mobile.router):
    app.include_router(router)


@app.on_event("startup")
def warm_up():
    try:
        pool = STATE.ensure_pool()
        df = STATE.get_dataset("balanced")
        result = train_all_models(df, dataset_config={"name": "balanced", "warm_up": True})
        STATE.set_trained(result["run_id"], "balanced", result["fitted_models"], result["results"])
        STATE._prepared_cache["balanced"] = result["prepared"]
        print(f"[TwinTrap] Warm-up complete. Pool={pool.shape}, active_model={STATE.active_model_id}", file=sys.stderr)
    except Exception:
        # Warm-up is a convenience only; the API still works and will
        # lazily generate data / require an explicit POST /api/train.
        traceback.print_exc(file=sys.stderr)


@app.get("/")
def root():
    return {"message": "TwinTrap AI backend is running. See /docs for the interactive API reference."}
