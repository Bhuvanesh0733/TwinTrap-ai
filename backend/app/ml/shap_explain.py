"""
shap_explain.py
================

Global + local SHAP explanations (spec section 17). We prefer
shap.TreeExplainer for tree-based models (Random Forest / XGBoost /
GradientBoosting fallback) because it is exact and fast even on a single
CPU core. For Logistic Regression we use shap.LinearExplainer (also
exact and fast). MLP falls back to a small-sample KernelExplainer, which
is model-agnostic but slower, so we cap the background/explain sample
sizes to keep it responsive.

Nothing here is fabricated: every SHAP value returned is computed from
the actual fitted model and actual feature values of the requested
sample (spec section 27: "Do NOT ... generate random SHAP explanations").
"""

from typing import Dict, List

import numpy as np
import shap

TREE_MODEL_IDS = {"random_forest", "xgboost"}


def _make_explainer(model, model_id: str, X_background: np.ndarray):
    if model_id in TREE_MODEL_IDS or model.__class__.__name__ in ("RandomForestClassifier", "XGBClassifier", "GradientBoostingClassifier"):
        return shap.TreeExplainer(model)
    if model_id == "logistic_regression":
        return shap.LinearExplainer(model, X_background)
    # MLP / generic fallback — small background for speed
    bg = shap.sample(X_background, min(50, len(X_background)), random_state=42)
    predict_fn = lambda x: model.predict_proba(x)[:, 1]
    return shap.KernelExplainer(predict_fn, bg)


def _raw_shap_values(explainer, X: np.ndarray, model_id: str):
    values = explainer.shap_values(X)
    # TreeExplainer on a binary classifier can return a list [class0, class1]
    # or a single (n, features) / (n, features, 2) array depending on
    # model type/shap version — normalize to the "class 1" (DRIFT) view.
    if isinstance(values, list):
        return np.array(values[1]) if len(values) > 1 else np.array(values[0])
    values = np.array(values)
    if values.ndim == 3:
        return values[:, :, 1]
    return values


def global_importance(model, model_id: str, X_background: np.ndarray, feature_names: List[str],
                       sample_size: int = 300) -> Dict:
    n = min(sample_size, len(X_background))
    rng = np.random.default_rng(42)
    idx = rng.choice(len(X_background), size=n, replace=False)
    X_sample = X_background[idx]

    explainer = _make_explainer(model, model_id, X_background[:min(100, len(X_background))])
    shap_vals = _raw_shap_values(explainer, X_sample, model_id)

    mean_abs = np.mean(np.abs(shap_vals), axis=0)
    order = np.argsort(mean_abs)[::-1]

    return {
        "model_id": model_id,
        "n_samples_used": int(n),
        "features": [feature_names[i] for i in order],
        "mean_abs_shap": [round(float(mean_abs[i]), 5) for i in order],
    }


def local_explanation(model, model_id: str, X_background: np.ndarray, X_sample_row: np.ndarray,
                       feature_names: List[str], top_k: int = 8) -> Dict:
    explainer = _make_explainer(model, model_id, X_background[:min(100, len(X_background))])
    shap_vals = _raw_shap_values(explainer, X_sample_row.reshape(1, -1), model_id)[0]

    proba = float(model.predict_proba(X_sample_row.reshape(1, -1))[0, 1])

    order = np.argsort(np.abs(shap_vals))[::-1][:top_k]
    contributors = [
        {"feature": feature_names[i], "shap_value": round(float(shap_vals[i]), 5),
         "direction": "increases_drift_probability" if shap_vals[i] > 0 else "decreases_drift_probability"}
        for i in order
    ]

    base_value = getattr(explainer, "expected_value", None)
    if isinstance(base_value, (list, np.ndarray)):
        base_value = float(np.array(base_value).reshape(-1)[-1])
    elif base_value is not None:
        base_value = float(base_value)

    return {
        "model_id": model_id,
        "drift_probability": round(proba, 4),
        "base_value": round(base_value, 5) if base_value is not None else None,
        "top_contributors": contributors,
    }
