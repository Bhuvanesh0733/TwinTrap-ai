import numpy as np
from fastapi import APIRouter, HTTPException, Query

from ..services.state import STATE
from ..ml.shap_explain import global_importance, local_explanation
from ..simulation.simulator import feature_columns

router = APIRouter()


def _require_model(model_id: str):
    model_id = model_id or STATE.active_model_id
    if not STATE.fitted_models or model_id not in STATE.fitted_models:
        raise HTTPException(status_code=404, detail="No trained model available. Call POST /api/train first.")
    return model_id, STATE.fitted_models[model_id]


@router.get("/api/shap/global")
def shap_global(model_id: str = Query(None)):
    model_id, model = _require_model(model_id)
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)

    cache_key = f"{model_id}::{STATE.last_train_dataset_name}"
    if cache_key not in STATE.shap_global_cache:
        try:
            STATE.shap_global_cache[cache_key] = global_importance(
                model, model_id, prepared.X_train, feature_columns()
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"SHAP global explanation failed: {e}")
    return STATE.shap_global_cache[cache_key]


@router.get("/api/shap/samples")
def shap_samples(model_id: str = Query(None), n: int = Query(12, ge=1, le=50)):
    model_id, model = _require_model(model_id)
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)

    n = min(n, len(prepared.y_test))
    rng = np.random.default_rng(7)
    idx = rng.choice(len(prepared.y_test), size=n, replace=False)
    proba = model.predict_proba(prepared.X_test[idx])[:, 1]

    samples = [
        {"sample_index": int(i), "true_label": int(prepared.y_test[i]), "predicted_probability": round(float(p), 4)}
        for i, p in zip(idx, proba)
    ]
    samples.sort(key=lambda s: s["predicted_probability"], reverse=True)
    return {"model_id": model_id, "samples": samples}


@router.get("/api/shap/local")
def shap_local(sample_index: int = Query(...), model_id: str = Query(None)):
    model_id, model = _require_model(model_id)
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)

    if sample_index < 0 or sample_index >= len(prepared.y_test):
        raise HTTPException(status_code=400, detail=f"sample_index out of range [0, {len(prepared.y_test) - 1}]")

    try:
        result = local_explanation(
            model, model_id, prepared.X_train, prepared.X_test[sample_index], feature_columns()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP local explanation failed: {e}")

    result["sample_index"] = sample_index
    result["true_label"] = int(prepared.y_test[sample_index])
    return result
