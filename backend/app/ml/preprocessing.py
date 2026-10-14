"""
preprocessing.py
=================

Implements the preprocessing pipeline required by the spec:
  * missing-value handling
  * duplicate detection/removal
  * outlier handling (IQR clipping, documented, applied using TRAIN stats only)
  * numerical feature scaling (StandardScaler)
  * stratified train/validation/test split
  * optional class weighting
  * feature list (feature selection = "use all documented discrepancy
    features"; see docs/methodology.md for the rationale)

Leakage discipline: the scaler (and IQR clip bounds) are FIT on the
training split only, then applied (transform-only) to validation/test.
The test split is never touched until final evaluation.
"""

from dataclasses import dataclass
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

from ..simulation.simulator import feature_columns

LABEL_COL = "label"


@dataclass
class PreparedData:
    X_train: np.ndarray
    X_val: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_val: np.ndarray
    y_test: np.ndarray
    feature_names: list
    scaler: StandardScaler
    class_weight: Dict[int, float]
    n_dropped_duplicates: int
    n_dropped_missing: int
    n_outliers_clipped: int


def clean_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, int, int]:
    """Missing-value handling + duplicate detection, returns (clean_df, n_dropped_missing, n_dropped_dupes)."""
    cols = feature_columns() + [LABEL_COL]
    before = len(df)
    df = df.dropna(subset=cols).copy()
    n_dropped_missing = before - len(df)

    before = len(df)
    df = df.drop_duplicates(subset=feature_columns()).copy()
    n_dropped_dupes = before - len(df)

    return df.reset_index(drop=True), n_dropped_missing, n_dropped_dupes


def clip_outliers_train_fit(X_train: np.ndarray, X_other_list, iqr_mult: float = 3.0):
    """
    Clip extreme outliers using an IQR rule FIT ON TRAIN ONLY, then apply
    the same bounds to the other splits (no leakage). iqr_mult=3.0 is a
    conservative ("extreme outlier") multiplier so genuine large
    discrepancies caused by real drift are not clipped away.
    """
    q1 = np.percentile(X_train, 25, axis=0)
    q3 = np.percentile(X_train, 75, axis=0)
    iqr = q3 - q1
    lower = q1 - iqr_mult * iqr
    upper = q3 + iqr_mult * iqr

    n_clipped = int(np.sum((X_train < lower) | (X_train > upper)))
    X_train_clipped = np.clip(X_train, lower, upper)
    others_clipped = [np.clip(X, lower, upper) for X in X_other_list]
    return X_train_clipped, others_clipped, n_clipped, lower, upper


def prepare_dataset(df: pd.DataFrame, test_size: float = 0.2, val_size: float = 0.15,
                     random_state: int = 42, use_class_weight: bool = True) -> PreparedData:
    df_clean, n_missing, n_dupes = clean_dataframe(df)
    feats = feature_columns()

    X = df_clean[feats].values.astype(float)
    y = df_clean[LABEL_COL].values.astype(int)

    # 1) split off test set first (never touched again until evaluation)
    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    # 2) split remainder into train / validation (used for tuning only)
    relative_val = val_size / (1 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_full, y_train_full, test_size=relative_val, random_state=random_state,
        stratify=y_train_full
    )

    X_train_clip, (X_val_clip, X_test_clip), n_clipped, _, _ = clip_outliers_train_fit(
        X_train, [X_val, X_test]
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_clip)
    X_val_scaled = scaler.transform(X_val_clip)
    X_test_scaled = scaler.transform(X_test_clip)

    class_weight = {}
    if use_class_weight:
        classes = np.unique(y_train)
        weights = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
        class_weight = {int(c): float(w) for c, w in zip(classes, weights)}

    return PreparedData(
        X_train=X_train_scaled, X_val=X_val_scaled, X_test=X_test_scaled,
        y_train=y_train, y_val=y_val, y_test=y_test,
        feature_names=feats, scaler=scaler, class_weight=class_weight,
        n_dropped_duplicates=n_dupes, n_dropped_missing=n_missing,
        n_outliers_clipped=n_clipped,
    )


def apply_smote(X_train: np.ndarray, y_train: np.ndarray, random_state: int = 42):
    """
    SMOTE (Synthetic Minority Over-sampling Technique), applied ONLY to
    the (already scaled) TRAIN split — never to validation/test, which
    would leak synthetic points that are interpolations of test-adjacent
    real points and inflate reported performance.

    Returns (X_resampled, y_resampled, info_dict). If a class has fewer
    than 6 samples, SMOTE's default k_neighbors=5 is reduced to fit.
    """
    from imblearn.over_sampling import SMOTE

    counts = np.bincount(y_train)
    minority_count = int(counts.min())
    k_neighbors = max(1, min(5, minority_count - 1))

    smote = SMOTE(random_state=random_state, k_neighbors=k_neighbors)
    X_res, y_res = smote.fit_resample(X_train, y_train)

    return X_res, y_res, {
        "method": "SMOTE",
        "k_neighbors": k_neighbors,
        "n_before": int(len(y_train)),
        "n_after": int(len(y_res)),
        "class_counts_before": {int(c): int(n) for c, n in zip(*np.unique(y_train, return_counts=True))},
        "class_counts_after": {int(c): int(n) for c, n in zip(*np.unique(y_res, return_counts=True))},
    }
