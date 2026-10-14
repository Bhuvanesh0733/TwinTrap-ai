"""
imbalance_experiment.py
========================

Automatically compares Balanced / 90:10 / 95:5 / 99:1 datasets (spec
section 16). For each configuration we resample from the same simulated
pool (see simulation/dataset_generator.py), train ONE representative
model (Random Forest by default — stable, fast, no scaling sensitivity)
with the SAME hyperparameters across all 4 configurations so the
comparison isolates the effect of class imbalance rather than confounding
it with different models, then compute full metrics + ROC/PR curves.

The interpretation strings are built programmatically from the actual
numbers produced (never hardcoded) — see `_build_interpretation`.
"""

from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from ..simulation.dataset_generator import resample_to_ratio, IMBALANCE_CONFIGS
from ..ml.preprocessing import prepare_dataset
from ..ml.classifiers import get_model_registry
from .metrics import compute_metrics, roc_curve_data, pr_curve_data

DEFAULT_MODEL_ID = "random_forest"
N_TOTAL_PER_CONFIG = 4000


def run_imbalance_experiment(pool: pd.DataFrame, model_id: str = DEFAULT_MODEL_ID,
                              n_total: int = N_TOTAL_PER_CONFIG, seed: int = 42) -> Dict:
    per_config = {}
    for name, ratio in IMBALANCE_CONFIGS.items():
        ds = resample_to_ratio(pool, ratio, n_total=n_total, seed=seed)
        prepared = prepare_dataset(ds, use_class_weight=True, random_state=seed)

        registry = get_model_registry(class_weight=prepared.class_weight)
        model = registry[model_id]
        model.fit(prepared.X_train, prepared.y_train)

        y_pred = model.predict(prepared.X_test)
        y_proba = model.predict_proba(prepared.X_test)[:, 1]

        metrics = compute_metrics(prepared.y_test, y_pred, y_proba)
        roc = roc_curve_data(prepared.y_test, y_proba)
        pr = pr_curve_data(prepared.y_test, y_proba)

        per_config[name] = {
            "config_name": name,
            "minority_ratio_requested": ratio,
            "actual_train_drift_ratio": round(float(np.mean(prepared.y_train)), 4),
            "actual_test_drift_ratio": round(float(np.mean(prepared.y_test)), 4),
            "n_train": int(len(prepared.y_train)),
            "n_test": int(len(prepared.y_test)),
            "metrics": metrics,
            "roc_curve": roc,
            "pr_curve": pr,
            "bootstrapped_minority": bool(ds.attrs.get("minority_bootstrapped", False)),
        }

    interpretation = _build_interpretation(per_config)

    return {
        "model_id": model_id,
        "configs": per_config,
        "interpretation": interpretation,
    }


def _build_interpretation(per_config: Dict) -> Dict:
    order = ["balanced", "moderate_90_10", "high_95_5", "severe_99_1"]
    order = [k for k in order if k in per_config]

    roc_aucs = [per_config[k]["metrics"]["roc_auc"] for k in order]
    aps = [per_config[k]["metrics"]["average_precision"] for k in order]
    recalls = [per_config[k]["metrics"]["recall"] for k in order]
    f1s = [per_config[k]["metrics"]["f1"] for k in order]

    def spread(values):
        vals = [v for v in values if v is not None]
        return (max(vals) - min(vals)) if vals else 0.0

    roc_spread = spread(roc_aucs)
    ap_spread = spread(aps)
    f1_spread = spread(f1s)
    recall_spread = spread(recalls)

    pr_more_informative = ap_spread > roc_spread

    lines = []
    lines.append(
        f"Across {', '.join(order)}, ROC-AUC ranged from {min(v for v in roc_aucs if v is not None):.3f} "
        f"to {max(v for v in roc_aucs if v is not None):.3f} (spread {roc_spread:.3f}), while Average "
        f"Precision ranged from {min(v for v in aps if v is not None):.3f} to "
        f"{max(v for v in aps if v is not None):.3f} (spread {ap_spread:.3f})."
    )
    if pr_more_informative:
        lines.append(
            "Average Precision moved more than ROC-AUC as the drift class became rarer, "
            "which is consistent with the expected behaviour under class imbalance: ROC-AUC "
            "is computed against the (large) negative class and stays optimistic even when "
            "precision on the rare positive class degrades, so the Precision-Recall curve is "
            "the more informative diagnostic here."
        )
    else:
        lines.append(
            "In this run, ROC-AUC and Average Precision moved by a similar amount across "
            "imbalance levels, so the usual PR-vs-ROC gap was not strongly observed here — "
            "re-run the experiment (results depend on the drawn samples) or inspect the "
            "per-config confusion matrices for a more granular view."
        )
    lines.append(
        f"F1 spread across configurations was {f1_spread:.3f} and Recall spread was "
        f"{recall_spread:.3f}, indicating how much detection performance on the rare DRIFT "
        f"class degrades as prevalence drops from 50% toward 1%."
    )

    return {
        "roc_auc_spread": round(roc_spread, 4),
        "average_precision_spread": round(ap_spread, 4),
        "f1_spread": round(f1_spread, 4),
        "recall_spread": round(recall_spread, 4),
        "pr_more_informative_than_roc": bool(pr_more_informative),
        "summary_text": " ".join(lines),
    }
