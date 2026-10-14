from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import (
    TrainRequest, TuneGridRequest, TuneRandomRequest, ActiveModelRequest,
    CrossValidationRequest, LearningCurveRequest,
)
from ..services.state import STATE
from ..ml.train_pipeline import train_all_models, model_comparison_table
from ..ml.tuning import run_grid_search, run_random_search, PARAM_GRIDS
from ..ml.classifiers import MODEL_DISPLAY_NAMES
from ..ml.cross_validation import run_cross_validation
from ..ml.learning_curve import run_learning_curve
from ..ml.feature_importance import get_feature_importance

router = APIRouter()


@router.post("/api/train")
def train(body: TrainRequest):
    try:
        df = STATE.get_dataset(body.dataset_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = train_all_models(df, dataset_config={"name": body.dataset_name},
                               use_class_weight=body.use_class_weight,
                               balancing_strategy=body.balancing_strategy)
    STATE.set_trained(result["run_id"], body.dataset_name, result["fitted_models"], result["results"])
    STATE._prepared_cache[body.dataset_name] = result["prepared"]

    return {
        "run_id": result["run_id"],
        "dataset_name": body.dataset_name,
        "balancing_strategy": result["balancing_strategy"],
        "smote_info": result["smote_info"],
        "comparison": model_comparison_table(result["results"]),
        "preprocessing_summary": result["preprocessing_summary"],
        "active_model_id": STATE.active_model_id,
    }


@router.get("/api/model-comparison")
def model_comparison():
    if not STATE.model_metrics:
        raise HTTPException(status_code=404, detail="No trained models yet. Call POST /api/train first.")
    return {
        "dataset_name": STATE.last_train_dataset_name,
        "run_id": STATE.last_train_run_id,
        "comparison": model_comparison_table(STATE.model_metrics),
        "active_model_id": STATE.active_model_id,
    }


@router.get("/api/models/available")
def available_models():
    return {
        "models": [{"model_id": k, "display_name": v, "trained": k in STATE.fitted_models}
                   for k, v in MODEL_DISPLAY_NAMES.items()],
        "tunable_models": list(PARAM_GRIDS.keys()),
    }


@router.post("/api/models/set-active")
def set_active_model(body: ActiveModelRequest):
    if body.model_id not in STATE.fitted_models:
        raise HTTPException(status_code=400, detail="Model is not trained yet. Train it first via POST /api/train.")
    STATE.active_model_id = body.model_id
    return {"active_model_id": STATE.active_model_id}


@router.post("/api/tune/grid")
def tune_grid(body: TuneGridRequest):
    if body.model_id not in PARAM_GRIDS:
        raise HTTPException(status_code=400, detail=f"GridSearchCV supported for: {list(PARAM_GRIDS.keys())}")
    if not STATE.last_train_dataset_name:
        raise HTTPException(status_code=400, detail="Train the models at least once first (POST /api/train) so a dataset/split is available.")
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)
    try:
        result = run_grid_search(body.model_id, prepared.X_train, prepared.y_train,
                                  prepared.X_test, prepared.y_test, class_weight=prepared.class_weight)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grid search failed: {e}")
    STATE.tuning_results[f"{body.model_id}::grid"] = result
    return result


@router.post("/api/tune/random")
def tune_random(body: TuneRandomRequest):
    if body.model_id not in PARAM_GRIDS:
        raise HTTPException(status_code=400, detail=f"RandomizedSearchCV supported for: {list(PARAM_GRIDS.keys())}")
    if not STATE.last_train_dataset_name:
        raise HTTPException(status_code=400, detail="Train the models at least once first (POST /api/train) so a dataset/split is available.")
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)
    try:
        result = run_random_search(body.model_id, prepared.X_train, prepared.y_train,
                                    prepared.X_test, prepared.y_test, n_iter=body.n_iter,
                                    class_weight=prepared.class_weight)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Random search failed: {e}")
    STATE.tuning_results[f"{body.model_id}::random"] = result
    return result


@router.get("/api/tuning-results")
def tuning_results():
    return {"results": STATE.tuning_results}


@router.post("/api/cross-validation")
def cross_validation(body: CrossValidationRequest):
    if not STATE.last_train_dataset_name:
        raise HTTPException(status_code=400, detail="Train the models at least once first (POST /api/train).")
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)
    try:
        result = run_cross_validation(body.model_id, prepared.X_train, prepared.y_train,
                                       class_weight=prepared.class_weight, cv_folds=body.cv_folds)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    STATE.tuning_results[f"{body.model_id}::cv"] = result
    return result


@router.post("/api/learning-curve")
def learning_curve(body: LearningCurveRequest):
    if not STATE.last_train_dataset_name:
        raise HTTPException(status_code=400, detail="Train the models at least once first (POST /api/train).")
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)
    try:
        result = run_learning_curve(body.model_id, prepared.X_train, prepared.y_train,
                                     class_weight=prepared.class_weight)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("/api/feature-importance")
def feature_importance(model_id: str = Query(None)):
    model_id = model_id or STATE.active_model_id
    if not STATE.fitted_models or model_id not in STATE.fitted_models:
        raise HTTPException(status_code=404, detail="No trained model available. Call POST /api/train first.")
    prepared = STATE.get_prepared(STATE.last_train_dataset_name)
    return get_feature_importance(STATE.fitted_models[model_id], model_id, prepared.feature_names)
