"""
classifiers.py
===============

Defines the 4 required classifiers. Each implements fit / predict /
predict_proba. XGBoost is used when importable; if the import fails at
runtime we fall back to sklearn's GradientBoostingClassifier and clearly
label the substitution everywhere it is reported (spec section 11).
"""

from typing import Dict

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier

XGBOOST_AVAILABLE = True
XGBOOST_IMPORT_ERROR = None
try:
    from xgboost import XGBClassifier
except Exception as e:  # pragma: no cover - environment dependent
    XGBOOST_AVAILABLE = False
    XGBOOST_IMPORT_ERROR = str(e)

RANDOM_STATE = 42


def get_model_registry(class_weight: Dict[int, float] = None) -> Dict[str, object]:
    """Returns fresh, unfit model instances keyed by canonical model_id."""
    sk_class_weight = "balanced" if class_weight else None

    models = {
        "logistic_regression": LogisticRegression(
            max_iter=2000,
            class_weight=sk_class_weight,
            random_state=RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=3,
            class_weight=sk_class_weight,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "mlp_neural_net": MLPClassifier(
            hidden_layer_sizes=(64, 32),
            activation="relu",
            alpha=1e-4,
            max_iter=400,
            early_stopping=True,
            random_state=RANDOM_STATE,
        ),
    }

    if XGBOOST_AVAILABLE:
        scale_pos_weight = 1.0
        if class_weight and 0 in class_weight and 1 in class_weight:
            scale_pos_weight = class_weight[0] / class_weight[1] if class_weight[1] else 1.0
        models["xgboost"] = XGBClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            scale_pos_weight=scale_pos_weight if class_weight else 1.0,
            n_jobs=-1,
        )
    else:
        # Documented fallback (spec section 11)
        models["xgboost"] = GradientBoostingClassifier(
            n_estimators=200, max_depth=3, learning_rate=0.1, random_state=RANDOM_STATE
        )

    return models


MODEL_DISPLAY_NAMES = {
    "logistic_regression": "Logistic Regression",
    "random_forest": "Random Forest",
    "xgboost": "XGBoost" if XGBOOST_AVAILABLE else "GradientBoosting (XGBoost fallback)",
    "mlp_neural_net": "MLP Neural Network",
}
