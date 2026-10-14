"""
cross_validation.py
=====================

Explicit k-fold Stratified Cross-Validation reporting (spec: "preserve
Cross-validation" as its own visible feature, distinct from its internal
use inside GridSearchCV/RandomizedSearchCV in tuning.py).

Run on the TRAIN split only (never test), so it never leaks into the
final held-out evaluation.
"""

from typing import Dict

import numpy as np
from sklearn.model_selection import cross_validate, StratifiedKFold

from .classifiers import get_model_registry, MODEL_DISPLAY_NAMES

SCORING = ["accuracy", "precision", "recall", "f1", "roc_auc"]


def run_cross_validation(model_id: str, X_train: np.ndarray, y_train: np.ndarray,
                          class_weight: Dict[int, float] = None, cv_folds: int = 5) -> Dict:
    registry = get_model_registry(class_weight=class_weight)
    if model_id not in registry:
        raise ValueError(f"Unknown model_id '{model_id}'")
    estimator = registry[model_id]

    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    scores = cross_validate(estimator, X_train, y_train, cv=cv, scoring=SCORING, n_jobs=-1)

    per_fold = {}
    summary = {}
    for metric in SCORING:
        key = f"test_{metric}"
        values = scores[key].tolist()
        per_fold[metric] = [round(float(v), 4) for v in values]
        summary[metric] = {"mean": round(float(np.mean(values)), 4), "std": round(float(np.std(values)), 4)}

    return {
        "model_id": model_id,
        "display_name": MODEL_DISPLAY_NAMES[model_id],
        "cv_folds": cv_folds,
        "scoring": SCORING,
        "per_fold_scores": per_fold,
        "summary": summary,
    }
