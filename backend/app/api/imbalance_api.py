from fastapi import APIRouter, HTTPException, Query

from ..services.state import STATE
from ..evaluation.imbalance_experiment import run_imbalance_experiment

router = APIRouter()


@router.get("/api/imbalance-experiment")
def get_imbalance_experiment(model_id: str = Query("random_forest"), refresh: bool = Query(False)):
    if STATE.imbalance_experiment is not None and not refresh and STATE.imbalance_experiment.get("model_id") == model_id:
        return STATE.imbalance_experiment
    try:
        pool = STATE.ensure_pool()
        result = run_imbalance_experiment(pool, model_id=model_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Imbalance experiment failed: {e}")
    STATE.imbalance_experiment = result
    return result
