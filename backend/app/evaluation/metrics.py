"""
metrics.py
==========

All evaluation numbers shown in the UI are computed here from real
model predictions on held-out data — nothing is hardcoded (spec section
27: "Do NOT fabricate results").
"""

from typing import Dict

import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, roc_curve, precision_recall_curve,
    confusion_matrix, classification_report,
)


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_proba: np.ndarray) -> Dict:
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
    }
    # ROC-AUC / AP require both classes present and probability scores
    if len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba))
        metrics["average_precision"] = float(average_precision_score(y_true, y_proba))
    else:
        metrics["roc_auc"] = None
        metrics["average_precision"] = None
    return {k: (round(v, 4) if v is not None else None) for k, v in metrics.items()}


def roc_curve_data(y_true: np.ndarray, y_proba: np.ndarray, max_points: int = 200) -> Dict:
    fpr, tpr, thresholds = roc_curve(y_true, y_proba)
    idx = _downsample_indices(len(fpr), max_points)
    # sklearn sets the very first threshold to +inf by convention (the
    # "predict nothing as positive" point); that isn't valid JSON, so we
    # clip it to 1.0 (a valid probability upper bound) for the API response.
    clipped_thresholds = np.clip(thresholds[idx], 0.0, 1.0)
    return {
        "fpr": [round(float(x), 5) for x in fpr[idx]],
        "tpr": [round(float(x), 5) for x in tpr[idx]],
        "thresholds": [round(float(x), 5) for x in clipped_thresholds],
        "auc": float(roc_auc_score(y_true, y_proba)),
    }


def pr_curve_data(y_true: np.ndarray, y_proba: np.ndarray, max_points: int = 200) -> Dict:
    precision, recall, thresholds = precision_recall_curve(y_true, y_proba)
    idx = _downsample_indices(len(precision), max_points)
    baseline = float(np.mean(y_true))
    return {
        "precision": [round(float(x), 5) for x in precision[idx]],
        "recall": [round(float(x), 5) for x in recall[idx]],
        "average_precision": float(average_precision_score(y_true, y_proba)),
        "baseline_prevalence": round(baseline, 5),
    }


def confusion_matrix_data(y_true: np.ndarray, y_pred: np.ndarray) -> Dict:
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    return {
        "matrix": cm.tolist(),
        "labels": ["HEALTHY (0)", "DRIFT (1)"],
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def classification_report_data(y_true: np.ndarray, y_pred: np.ndarray) -> Dict:
    return classification_report(y_true, y_pred, target_names=["HEALTHY", "DRIFT"],
                                  output_dict=True, zero_division=0)


def _downsample_indices(n: int, max_points: int) -> np.ndarray:
    if n <= max_points:
        return np.arange(n)
    idx = np.linspace(0, n - 1, max_points).astype(int)
    return idx
