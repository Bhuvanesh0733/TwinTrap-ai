"""
pca_svd.py
==========

Implements the two required linear-algebra analyses:

1) PCA (via sklearn.decomposition.PCA) projected to 2 components for the
   PC1/PC2 scatter plot, plus explained-variance reporting for a wider
   range of component counts.

2) An EXPLICIT Singular Value Decomposition using
   ``U, S, Vt = np.linalg.svd(X_standardized, full_matrices=False)``
   with no library hiding the computation, returning the raw shapes and
   singular values as required by the spec ("The project must visibly
   demonstrate the actual SVD implementation").

Relationship between the two (documented for the UI's educational copy):
For mean-centered, standardized data X (n_samples x n_features):
    X = U @ diag(S) @ Vt
The right singular vectors (rows of Vt) are exactly the PCA principal
axes, and the explained variance of component i is S[i]**2 / (n-1),
i.e. PCA can be derived directly from the SVD of the centered data
matrix. We compute PCA via sklearn for convenience/robustness and SVD
manually via np.linalg.svd to *show the underlying decomposition*, and
we cross-check that the two agree (see /api/svd's `matches_pca` field).
"""

from typing import Dict

import numpy as np
from sklearn.decomposition import PCA


def run_pca(X_scaled: np.ndarray, y: np.ndarray, n_components_report: int = 10) -> Dict:
    n_components_report = min(n_components_report, X_scaled.shape[1], X_scaled.shape[0])

    pca_full = PCA(n_components=n_components_report, random_state=42)
    pca_full.fit(X_scaled)

    pca_2d = PCA(n_components=2, random_state=42)
    coords = pca_2d.fit_transform(X_scaled)

    points = [
        {"pc1": float(coords[i, 0]), "pc2": float(coords[i, 1]), "label": int(y[i])}
        for i in range(len(y))
    ]

    explained = pca_full.explained_variance_ratio_.tolist()
    cumulative = np.cumsum(explained).tolist()

    return {
        "n_components_computed": int(n_components_report),
        "explained_variance_ratio": [round(float(v), 6) for v in explained],
        "cumulative_explained_variance": [round(float(v), 6) for v in cumulative],
        "pc1_explained_variance": round(float(explained[0]), 6) if explained else None,
        "pc2_explained_variance": round(float(explained[1]), 6) if len(explained) > 1 else None,
        "points": points,
        "n_samples": int(X_scaled.shape[0]),
        "n_features": int(X_scaled.shape[1]),
    }


def run_svd(X_scaled: np.ndarray, top_k: int = 15) -> Dict:
    """
    Explicit SVD via np.linalg.svd — NOT wrapped inside sklearn's PCA.
    X_scaled is assumed already standardized (mean 0, unit variance per
    the StandardScaler fit during preprocessing), matching the
    "Raw features -> Standardization -> PCA" pipeline described in the
    spec, so U/S/Vt are computed on the same matrix PCA sees.
    """
    U, S, Vt = np.linalg.svd(X_scaled, full_matrices=False)

    n = X_scaled.shape[0]
    variance_per_component = (S ** 2) / (n - 1)
    total_variance = float(np.sum(variance_per_component))
    explained_ratio = (variance_per_component / total_variance).tolist() if total_variance > 0 else []

    top_k = min(top_k, len(S))

    # Cross-check against sklearn PCA's explained variance ratio (should match closely)
    pca_check = PCA(n_components=min(5, X_scaled.shape[1])).fit(X_scaled)
    matches_pca = bool(np.allclose(
        explained_ratio[:len(pca_check.explained_variance_ratio_)],
        pca_check.explained_variance_ratio_, atol=1e-3
    ))

    return {
        "U_shape": list(U.shape),
        "S_shape": list(S.shape),
        "Vt_shape": list(Vt.shape),
        "singular_values": [round(float(v), 4) for v in S[:top_k]],
        "explained_variance_ratio": [round(float(v), 6) for v in explained_ratio[:top_k]],
        "cumulative_explained_variance": [round(float(v), 6) for v in np.cumsum(explained_ratio[:top_k])],
        "matches_pca": matches_pca,
        "reconstruction_formula": "X = U @ diag(S) @ Vt",
        "interpretation": {
            "U": "Left singular vectors (n_samples x k): each row projects one sample onto the k orthogonal latent directions; U's columns are orthonormal.",
            "S": "Singular values (k,): the magnitude/energy of each latent direction, sorted descending. S[i]**2/(n-1) equals the variance explained by direction i.",
            "Vt": "Right singular vectors (k x n_features), transposed: each row is a unit vector in the original 30-feature discrepancy space, i.e. the principal axes themselves (identical to PCA's components_).",
        },
    }
