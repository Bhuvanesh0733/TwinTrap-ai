from fastapi import APIRouter, HTTPException, Query

from ..services.state import STATE
from ..evaluation.metrics import (
    compute_metrics, roc_curve_data, pr_curve_data, confusion_matrix_data, classification_report_data,
)

router = APIRouter()


@router.get("/api/evaluation")
def evaluation(model_id: str = Query(None)):
    if not STATE.fitted_models:
        raise HTTPException(status_code=404, detail="No trained models yet. Call POST /api/train first.")
    model_id = model_id or STATE.active_model_id
    if model_id not in STATE.fitted_models:
        raise HTTPException(status_code=400, detail=f"Unknown or untrained model_id '{model_id}'.")

    prepared = STATE.get_prepared(STATE.last_train_dataset_name)
    model = STATE.fitted_models[model_id]

    y_pred = model.predict(prepared.X_test)
    y_proba = model.predict_proba(prepared.X_test)[:, 1]

    return {
        "model_id": model_id,
        "dataset_name": STATE.last_train_dataset_name,
        "n_test": int(len(prepared.y_test)),
        "metrics": compute_metrics(prepared.y_test, y_pred, y_proba),
        "roc_curve": roc_curve_data(prepared.y_test, y_proba),
        "pr_curve": pr_curve_data(prepared.y_test, y_proba),
        "confusion_matrix": confusion_matrix_data(prepared.y_test, y_pred),
        "classification_report": classification_report_data(prepared.y_test, y_pred),
    }
