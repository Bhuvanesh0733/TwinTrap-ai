"""
learning_curve.py
===================

sklearn.model_selection.learning_curve: shows how train vs
cross-validation F1 score change as the training-set size grows, which
diagnoses under/overfitting. Computed on the TRAIN split only.
"""

from typing import Dict

import numpy as np
from sklearn.model_selection import learning_curve, StratifiedKFold

from .classifiers import get_model_registry, MODEL_DISPLAY_NAMES


def run_learning_curve(model_id: str, X_train: np.ndarray, y_train: np.ndarray,
                        class_weight: Dict[int, float] = None, cv_folds: int = 3) -> Dict:
    registry = get_model_registry(class_weight=class_weight)
    if model_id not in registry:
        raise ValueError(f"Unknown model_id '{model_id}'")
    estimator = registry[model_id]

    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    train_sizes = np.linspace(0.1, 1.0, 6)

    sizes_abs, train_scores, val_scores = learning_curve(
        estimator, X_train, y_train, cv=cv, scoring="f1",
        train_sizes=train_sizes, n_jobs=-1, random_state=42,
    )

    return {
        "model_id": model_id,
        "display_name": MODEL_DISPLAY_NAMES[model_id],
        "train_sizes": [int(s) for s in sizes_abs],
        "train_score_mean": [round(float(v), 4) for v in train_scores.mean(axis=1)],
        "train_score_std": [round(float(v), 4) for v in train_scores.std(axis=1)],
        "val_score_mean": [round(float(v), 4) for v in val_scores.mean(axis=1)],
        "val_score_std": [round(float(v), 4) for v in val_scores.std(axis=1)],
        "scoring": "f1",
    }
