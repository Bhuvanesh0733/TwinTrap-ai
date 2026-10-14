"""
lda.py
======

Linear Discriminant Analysis (LDA), added alongside PCA/SVD.

Unlike PCA (unsupervised, maximizes variance), LDA is SUPERVISED: it
finds the projection that best SEPARATES the HEALTHY and DRIFT classes.
For a binary problem there is exactly one discriminant axis
(n_classes - 1 = 1), so we report:
  * the 1D LDA projection of every training sample (for a strip/rug or
    histogram plot, healthy vs drift)
  * Fisher's separation criterion (between-class variance / within-class
    variance) on that axis, a real, computed number - not invented
  * the linear coefficients (which original features drive the
    separation most), analogous to PCA's loadings

LDA is fit on the TRAIN split only, exactly like PCA/SVD.
"""

from typing import Dict, List

import numpy as np
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis


def run_lda(X_scaled: np.ndarray, y: np.ndarray, feature_names: List[str]) -> Dict:
    lda = LinearDiscriminantAnalysis(n_components=1)
    projected = lda.fit_transform(X_scaled, y).ravel()

    healthy_scores = projected[y == 0]
    drift_scores = projected[y == 1]

    between_class_var = (healthy_scores.mean() - drift_scores.mean()) ** 2
    within_class_var = healthy_scores.var() + drift_scores.var()
    fisher_ratio = float(between_class_var / within_class_var) if within_class_var > 0 else None

    coefs = lda.coef_.ravel()
    order = np.argsort(np.abs(coefs))[::-1]

    return {
        "ld1_healthy": [round(float(v), 4) for v in healthy_scores.tolist()],
        "ld1_drift": [round(float(v), 4) for v in drift_scores.tolist()],
        "healthy_mean": round(float(healthy_scores.mean()), 4),
        "drift_mean": round(float(drift_scores.mean()), 4),
        "fisher_separation_ratio": round(fisher_ratio, 4) if fisher_ratio is not None else None,
        "top_features": [feature_names[i] for i in order[:10]],
        "top_feature_coefficients": [round(float(coefs[i]), 5) for i in order[:10]],
        "explanation": (
            "LDA finds the single linear axis (LD1) that maximizes the "
            "separation between HEALTHY and DRIFT means relative to their "
            "within-class spread (Fisher's criterion). Unlike PCA it uses "
            "the labels, so it is a supervised complement to the "
            "unsupervised PCA/SVD view."
        ),
    }
