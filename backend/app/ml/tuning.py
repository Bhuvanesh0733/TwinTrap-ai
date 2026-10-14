"""
tuning.py
=========

Implements GridSearchCV and RandomizedSearchCV (spec section 13) on
Random Forest and XGBoost. Search spaces are intentionally SMALL so a
tuning run completes in a few seconds to a couple of minutes on a
single CPU core, as requested ("Do not perform extremely expensive
searches by default").

Tuning always happens on TRAIN (+ internal CV folds) only. The chosen
best estimator is then scored once on the held-out TEST split, which is
reported separately as "final test performance" and is never used to
pick the hyperparameters themselves (no leakage).
"""

import time
from typing import Dict

from sklearn.model_selection import GridSearchCV, RandomizedSearchCV, StratifiedKFold

from .classifiers import get_model_registry
from ..evaluation.metrics import compute_metrics

PARAM_GRIDS = {
    "random_forest": {
        "n_estimators": [100, 200],
        "max_depth": [4, 8, 12],
        "min_samples_leaf": [1, 3],
    },
    "xgboost": {
        "n_estimators": [100, 200],
        "max_depth": [3, 4, 6],
        "learning_rate": [0.05, 0.1],
    },
}

SCORING = "f1"  # F1 chosen because drift is the minority/important class; see docs/methodology.md
CV_FOLDS = 3


def _base_estimator(model_id: str, class_weight: Dict[int, float]):
    registry = get_model_registry(class_weight=class_weight)
    if model_id not in registry:
        raise ValueError(f"Tuning is only supported for {list(PARAM_GRIDS.keys())}")
    return registry[model_id]


def run_grid_search(model_id: str, X_train, y_train, X_test, y_test,
                     class_weight: Dict[int, float] = None) -> Dict:
    if model_id not in PARAM_GRIDS:
        raise ValueError(f"GridSearchCV is only wired up for: {list(PARAM_GRIDS.keys())}")

    grid = PARAM_GRIDS[model_id]
    estimator = _base_estimator(model_id, class_weight)
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)

    n_combinations = 1
    for v in grid.values():
        n_combinations *= len(v)

    search = GridSearchCV(estimator, grid, scoring=SCORING, cv=cv, n_jobs=-1, refit=True)
    t0 = time.time()
    search.fit(X_train, y_train)
    elapsed = time.time() - t0

    y_pred = search.best_estimator_.predict(X_test)
    y_proba = search.best_estimator_.predict_proba(X_test)[:, 1]
    test_metrics = compute_metrics(y_test, y_pred, y_proba)

    return {
        "method": "GridSearchCV",
        "model_id": model_id,
        "param_grid": grid,
        "n_combinations": n_combinations,
        "cv_folds": CV_FOLDS,
        "scoring": SCORING,
        "best_params": search.best_params_,
        "best_cv_score": round(float(search.best_score_), 4),
        "test_metrics": test_metrics,
        "elapsed_seconds": round(elapsed, 2),
    }


def run_random_search(model_id: str, X_train, y_train, X_test, y_test,
                       n_iter: int = 12, class_weight: Dict[int, float] = None) -> Dict:
    if model_id not in PARAM_GRIDS:
        raise ValueError(f"RandomizedSearchCV is only wired up for: {list(PARAM_GRIDS.keys())}")

    grid = PARAM_GRIDS[model_id]
    estimator = _base_estimator(model_id, class_weight)
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)

    n_combinations = 1
    for v in grid.values():
        n_combinations *= len(v)
    n_iter = min(n_iter, n_combinations)

    search = RandomizedSearchCV(
        estimator, grid, n_iter=n_iter, scoring=SCORING, cv=cv,
        random_state=42, n_jobs=-1, refit=True,
    )
    t0 = time.time()
    search.fit(X_train, y_train)
    elapsed = time.time() - t0

    y_pred = search.best_estimator_.predict(X_test)
    y_proba = search.best_estimator_.predict_proba(X_test)[:, 1]
    test_metrics = compute_metrics(y_test, y_pred, y_proba)

    return {
        "method": "RandomizedSearchCV",
        "model_id": model_id,
        "param_grid": grid,
        "n_combinations_total": n_combinations,
        "n_iterations_sampled": n_iter,
        "cv_folds": CV_FOLDS,
        "scoring": SCORING,
        "best_params": search.best_params_,
        "best_cv_score": round(float(search.best_score_), 4),
        "test_metrics": test_metrics,
        "elapsed_seconds": round(elapsed, 2),
    }
