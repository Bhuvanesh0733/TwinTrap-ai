"""
train_pipeline.py
==================

Orchestrates: preprocess -> fit each of the 4 classifiers -> evaluate on
the held-out TEST split -> persist reproducible artifacts.

Reproducibility (spec section 26): every run uses RANDOM_STATE=42
(see classifiers.py / preprocessing.py), and each call saves the fitted
scaler, models, and a JSON snapshot of the exact dataset configuration +
results to backend/experiments/<run_id>/, so any number displayed in the
UI can be traced back to the run that produced it.
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd

from .preprocessing import prepare_dataset, PreparedData, apply_smote
from .classifiers import get_model_registry, MODEL_DISPLAY_NAMES, XGBOOST_AVAILABLE
from ..evaluation.metrics import compute_metrics

EXPERIMENTS_DIR = Path(__file__).resolve().parents[2] / "experiments"
EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)


def _new_run_dir() -> Path:
    run_id = time.strftime("run_%Y%m%d_%H%M%S")
    d = EXPERIMENTS_DIR / run_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def train_all_models(df: pd.DataFrame, dataset_config: Dict, use_class_weight: bool = True,
                      balancing_strategy: str = "class_weight", persist: bool = True) -> Dict:
    """
    balancing_strategy:
      "class_weight" - sample-weighted loss (default; no synthetic rows)
      "smote"         - SMOTE-oversample the TRAIN split before fitting
      "none"          - no imbalance handling at all (useful as a baseline)
    """
    use_cw = use_class_weight and balancing_strategy == "class_weight"
    prepared = prepare_dataset(df, use_class_weight=use_cw)
    registry = get_model_registry(class_weight=prepared.class_weight if use_cw else None)

    X_train, y_train = prepared.X_train, prepared.y_train
    smote_info = None
    if balancing_strategy == "smote":
        X_train, y_train, smote_info = apply_smote(prepared.X_train, prepared.y_train)

    results = {}
    fitted_models = {}
    for model_id, model in registry.items():
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = time.time() - t0

        y_pred = model.predict(prepared.X_test)
        y_proba = model.predict_proba(prepared.X_test)[:, 1]
        metrics = compute_metrics(prepared.y_test, y_pred, y_proba)

        fitted_models[model_id] = model
        results[model_id] = {
            "model_id": model_id,
            "display_name": MODEL_DISPLAY_NAMES[model_id],
            "metrics": metrics,
            "train_time_seconds": round(train_time, 3),
            "n_train": int(len(y_train)),
            "n_test": int(len(prepared.y_test)),
        }

    run_dir = None
    if persist:
        run_dir = _new_run_dir()
        joblib.dump(prepared.scaler, run_dir / "scaler.joblib")
        for model_id, model in fitted_models.items():
            joblib.dump(model, run_dir / f"model_{model_id}.joblib")
        snapshot = {
            "dataset_config": dataset_config,
            "balancing_strategy": balancing_strategy,
            "smote_info": smote_info,
            "results": results,
            "preprocessing": {
                "n_dropped_missing": prepared.n_dropped_missing,
                "n_dropped_duplicates": prepared.n_dropped_duplicates,
                "n_outliers_clipped": prepared.n_outliers_clipped,
                "class_weight": prepared.class_weight,
                "n_train": int(len(y_train)),
                "n_val": int(len(prepared.y_val)),
                "n_test": int(len(prepared.y_test)),
            },
            "xgboost_available": XGBOOST_AVAILABLE,
            "random_state": 42,
        }
        (run_dir / "experiment.json").write_text(json.dumps(snapshot, indent=2, default=str))

    return {
        "run_id": run_dir.name if run_dir else None,
        "prepared": prepared,
        "fitted_models": fitted_models,
        "results": results,
        "balancing_strategy": balancing_strategy,
        "smote_info": smote_info,
        "preprocessing_summary": {
            "n_dropped_missing": prepared.n_dropped_missing,
            "n_dropped_duplicates": prepared.n_dropped_duplicates,
            "n_outliers_clipped": prepared.n_outliers_clipped,
            "class_weight": prepared.class_weight,
            "n_train": int(len(y_train)),
            "n_val": int(len(prepared.y_val)),
            "n_test": int(len(prepared.y_test)),
        },
    }


def model_comparison_table(results: Dict) -> List[Dict]:
    rows = []
    for model_id, r in results.items():
        row = {"model_id": model_id, "model": r["display_name"], **r["metrics"],
               "train_time_seconds": r["train_time_seconds"]}
        rows.append(row)
    rows.sort(key=lambda r: (r["f1"] is not None, r["f1"] or 0), reverse=True)
    return rows
