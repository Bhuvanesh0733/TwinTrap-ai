"""
state.py
========

A single in-memory AppState instance (module-level singleton) shared by
all API routes. TwinTrap runs locally, single-user, so this avoids the
overhead of a full database while still persisting reproducible
artifacts to disk (backend/experiments/, see ml/train_pipeline.py) and a
lightweight SQLite log of the live simulation (services/sim_log.py).

This module intentionally contains NO FastAPI-specific code so it stays
independent of the API layer (spec section 25: "Keep ML logic separate
from API logic").
"""

from collections import deque
from typing import Dict, Optional

import numpy as np
import pandas as pd

from ..simulation.simulator import TwinTrapSimulator
from ..simulation.dataset_generator import generate_pool, resample_to_ratio, IMBALANCE_CONFIGS, dataset_summary
from ..ml.preprocessing import prepare_dataset, PreparedData
from ..utils.fidelity import twin_fidelity, drift_severity

DEFAULT_DATASET_CONFIG = {"n_episodes": 160, "episode_length": 180, "seed": 42}
N_TOTAL_PER_DATASET = 4000


class AppState:
    def __init__(self):
        self.pool_df: Optional[pd.DataFrame] = None
        self.pool_config: Dict = dict(DEFAULT_DATASET_CONFIG)

        self._dataset_cache: Dict[str, pd.DataFrame] = {}
        self._prepared_cache: Dict[str, PreparedData] = {}
        self.current_dataset_name: str = "balanced"

        self.fitted_models: Dict[str, object] = {}
        self.model_metrics: Dict[str, Dict] = {}
        self.last_train_run_id: Optional[str] = None
        self.last_train_dataset_name: Optional[str] = None
        self.active_model_id: Optional[str] = None

        self.tuning_results: Dict[str, Dict] = {}
        self.imbalance_experiment: Optional[Dict] = None
        self.pca_cache: Optional[Dict] = None
        self.svd_cache: Optional[Dict] = None
        self.shap_global_cache: Dict[str, Dict] = {}

        self.simulator = TwinTrapSimulator(seed=42)
        self.sim_history = deque(maxlen=400)
        self.sim_running = False

    # ---------------------------------------------------------------- pool
    def ensure_pool(self) -> pd.DataFrame:
        if self.pool_df is None:
            self.regenerate_pool(**self.pool_config)
        return self.pool_df

    def regenerate_pool(self, n_episodes: int = 160, episode_length: int = 180, seed: int = 42):
        self.pool_df = generate_pool(n_episodes=n_episodes, episode_length=episode_length, seed=seed)
        self.pool_config = {"n_episodes": n_episodes, "episode_length": episode_length, "seed": seed}
        self._dataset_cache = {}
        self._prepared_cache = {}
        self.fitted_models = {}
        self.model_metrics = {}
        self.pca_cache = None
        self.svd_cache = None
        self.imbalance_experiment = None
        self.shap_global_cache = {}

    # ------------------------------------------------------------ datasets
    def get_dataset(self, config_name: str) -> pd.DataFrame:
        if config_name not in IMBALANCE_CONFIGS:
            raise ValueError(f"Unknown dataset config '{config_name}'. Choose from {list(IMBALANCE_CONFIGS)}")
        if config_name not in self._dataset_cache:
            pool = self.ensure_pool()
            ratio = IMBALANCE_CONFIGS[config_name]
            self._dataset_cache[config_name] = resample_to_ratio(pool, ratio, n_total=N_TOTAL_PER_DATASET, seed=42)
        return self._dataset_cache[config_name]

    def get_prepared(self, config_name: str) -> PreparedData:
        if config_name not in self._prepared_cache:
            df = self.get_dataset(config_name)
            self._prepared_cache[config_name] = prepare_dataset(df, use_class_weight=True)
        return self._prepared_cache[config_name]

    def dataset_summary(self, config_name: Optional[str] = None) -> Dict:
        df = self.get_dataset(config_name) if config_name else self.ensure_pool()
        return dataset_summary(df)

    # -------------------------------------------------------------- models
    def set_trained(self, run_id: str, dataset_name: str, fitted_models: Dict, results: Dict):
        self.last_train_run_id = run_id
        self.last_train_dataset_name = dataset_name
        self.fitted_models = fitted_models
        self.model_metrics = results
        # default active model = best F1 on this run
        best_id, best_f1 = None, -1
        for mid, r in results.items():
            f1 = r["metrics"].get("f1") or 0
            if f1 > best_f1:
                best_id, best_f1 = mid, f1
        self.active_model_id = best_id

    def get_active_model(self):
        if self.active_model_id and self.active_model_id in self.fitted_models:
            return self.active_model_id, self.fitted_models[self.active_model_id]
        return None, None

    # ---------------------------------------------------------- live scoring
    def score_live_record(self, record: Dict) -> Dict:
        """Combine a live simulator record with the active ML model (if any) + fidelity/severity."""
        abs_diffs = {s: record[f"{s}_abs_diff"] for s in ["temperature", "vibration", "rpm", "current", "torque", "pressure"]}
        fidelity = twin_fidelity(abs_diffs)

        model_id, model = self.get_active_model()
        prepared = self._prepared_cache.get(self.last_train_dataset_name) if self.last_train_dataset_name else None

        if model is not None and prepared is not None:
            from ..simulation.simulator import feature_columns
            feats = feature_columns()
            x = np.array([[record[f] for f in feats]], dtype=float)
            x_scaled = prepared.scaler.transform(x)
            drift_probability = float(model.predict_proba(x_scaled)[0, 1])
            source = f"model:{model_id}"
        else:
            # Heuristic fallback (explicitly labeled, NOT presented as a model
            # prediction) used only before any model has been trained yet.
            drift_probability = round(1.0 - fidelity / 100.0, 4)
            source = "heuristic_fallback_no_trained_model"

        severity = drift_severity(drift_probability)

        return {
            "twin_fidelity": fidelity,
            "drift_probability": round(drift_probability, 4),
            "status": "DRIFTED / UNSYNCHRONIZED" if drift_probability > 0.5 else "HEALTHY / SYNCHRONIZED",
            "severity": severity,
            "prediction_source": source,
            "ground_truth_label": record["label"],
            "drift_type": record["drift_type"],
            "operating_condition": record["operating_condition"],
        }


STATE = AppState()
