"""
feature_importance.py
=======================

Native, model-specific feature importance — distinct from SHAP
(explainability.py / shap_explain.py). For tree ensembles this is the
impurity-based `.feature_importances_`; for Logistic Regression it is
the absolute standardized coefficient magnitude. MLP has no native
importance measure, so we report that explicitly rather than
approximating it.
"""

from typing import Dict, List

import numpy as np


def get_feature_importance(model, model_id: str, feature_names: List[str]) -> Dict:
    if hasattr(model, "feature_importances_"):
        importances = np.asarray(model.feature_importances_, dtype=float)
        method = "impurity_based (native .feature_importances_)"
    elif hasattr(model, "coef_"):
        importances = np.abs(np.asarray(model.coef_, dtype=float).ravel())
        method = "absolute standardized logistic-regression coefficient"
    else:
        return {
            "model_id": model_id,
            "available": False,
            "reason": "This model (e.g. MLP) has no native feature-importance measure. Use the SHAP Explainability page instead.",
            "features": [], "importances": [],
        }

    order = np.argsort(importances)[::-1]
    total = float(importances.sum()) or 1.0
    return {
        "model_id": model_id,
        "available": True,
        "method": method,
        "features": [feature_names[i] for i in order],
        "importances": [round(float(importances[i]), 5) for i in order],
        "importances_normalized": [round(float(importances[i] / total), 5) for i in order],
    }
