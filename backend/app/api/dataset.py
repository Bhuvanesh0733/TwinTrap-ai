from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import DatasetRegenerateRequest
from ..services.state import STATE
from ..simulation.dataset_generator import IMBALANCE_CONFIGS
from ..simulation.simulator import feature_columns

router = APIRouter()


@router.get("/api/dataset/configs")
def dataset_configs():
    return {
        "configs": [{"name": k, "minority_ratio": v} for k, v in IMBALANCE_CONFIGS.items()],
        "pool_config": STATE.pool_config,
    }


@router.get("/api/dataset/summary")
def dataset_summary(config: str = Query(None, description="One of the imbalance config names, omit for the raw simulated pool")):
    try:
        return STATE.dataset_summary(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/dataset/sample")
def dataset_sample(config: str = Query("balanced"), n: int = Query(25, ge=1, le=200)):
    try:
        df = STATE.get_dataset(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    cols = ["step", "episode_id", "load", "label", "drift_type", "operating_condition", "source"] + feature_columns()[:10]
    cols = [c for c in cols if c in df.columns]
    sample = df[cols].sample(n=min(n, len(df)), random_state=7).reset_index(drop=True)
    return {"columns": cols, "rows": sample.to_dict(orient="records")}


@router.get("/api/dataset/feature-stats")
def feature_stats(config: str = Query("balanced")):
    try:
        df = STATE.get_dataset(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    feats = feature_columns()
    desc = df[feats].describe().T
    desc["missing"] = df[feats].isna().sum()
    return {"stats": desc.reset_index().rename(columns={"index": "feature"}).to_dict(orient="records")}


@router.post("/api/dataset/regenerate")
def regenerate_dataset(body: DatasetRegenerateRequest):
    try:
        STATE.regenerate_pool(n_episodes=body.n_episodes, episode_length=body.episode_length, seed=body.seed)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not regenerate dataset: {e}")
    return {"status": "regenerated", "pool_config": STATE.pool_config, "summary": STATE.dataset_summary()}
