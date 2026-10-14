"""
dataset_generator.py
=====================

Builds the labeled dataset used to train and evaluate the ML models.

Method (documented for the report / README, see docs/methodology.md):
  1. Run many independent short "episodes" through TwinTrapSimulator.
     Each episode either stays fully healthy, or has one of the 8 drift
     scenarios injected at a random point with a random severity and
     profile.
  2. Concatenate every step of every episode into one "pool" DataFrame.
     Every row is individually labeled 0/1 by the SAME thresholding rule
     used in drift.py (DriftController.active_summary), so gradual-drift
     episodes naturally contain both healthy rows (before the fault
     crosses the labeling threshold) and drift rows (after).
  3. To study class imbalance (section "Class Imbalance" of the spec) we
     do not regenerate physics for every ratio. Instead we draw
     stratified random samples (rows may be reused/bootstrapped when a
     ratio demands more minority-class rows than the pool has) FROM the
     same simulated pool to hit an exact target ratio. This is a
     resampling / experimental-design step, not fabrication of new data
     points — every row still comes from the physics simulation.

Every row carries `source = "simulation"` so it is always traceable, per
the requirement to clearly distinguish SIMULATED vs PUBLIC DATASET vs
INJECTED DRIFT data (see docs/methodology.md and README §Dataset).
"""

from typing import Optional

import numpy as np
import pandas as pd

from .simulator import TwinTrapSimulator, feature_columns
from .drift import DRIFT_TYPES

DEFAULT_EPISODE_LENGTH = 180
DEFAULT_N_EPISODES = 160
HEALTHY_EPISODE_PROB = 0.30


def _run_episode(ep_seed: int, episode_length: int, rng: np.random.Generator, episode_id: int) -> pd.DataFrame:
    sim = TwinTrapSimulator(seed=ep_seed)

    is_healthy_episode = rng.random() < HEALTHY_EPISODE_PROB
    if not is_healthy_episode:
        drift_type = DRIFT_TYPES[rng.integers(0, len(DRIFT_TYPES))]
        severity = float(rng.uniform(0.45, 1.0))
        start_step = int(rng.integers(10, max(11, episode_length // 2)))
        profile = None
        if drift_type not in ("gradual", "sudden", "operating_condition"):
            profile = "gradual" if rng.random() < 0.6 else "sudden"
        ramp_steps = int(rng.integers(40, 160))

        # advance to the injection point first (healthy baseline), then inject
        for _ in range(start_step):
            sim.step()
        sim.inject(drift_type, severity=severity, profile=profile, ramp_steps=ramp_steps)
    else:
        # occasionally vary the *baseline* regime within the normal envelope
        # (idle vs normal) purely for feature diversity - still label 0.
        if rng.random() < 0.25:
            sim.drift.regime = "idle"

    rows = [sim.step() for _ in range(episode_length)]
    df = pd.DataFrame(rows)
    df["episode_id"] = episode_id
    df["source"] = "simulation"
    return df


def generate_pool(n_episodes: int = DEFAULT_N_EPISODES,
                   episode_length: int = DEFAULT_EPISODE_LENGTH,
                   seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    frames = []
    for i in range(n_episodes):
        ep_seed = int(rng.integers(0, 1_000_000))
        frames.append(_run_episode(ep_seed, episode_length, rng, episode_id=i))
    pool = pd.concat(frames, ignore_index=True)
    return pool


def resample_to_ratio(pool: pd.DataFrame, minority_ratio: float, n_total: int,
                       seed: int = 42) -> pd.DataFrame:
    """
    Draw a stratified sample from `pool` so that exactly `minority_ratio`
    of the returned rows have label == 1.

    If the pool doesn't contain enough rows of a class, that class is
    sampled WITH replacement (bootstrap) and this is recorded so it can
    be surfaced honestly in the UI/report rather than hidden.
    """
    rng_state = np.random.RandomState(seed)
    n_minority = max(1, int(round(n_total * minority_ratio)))
    n_majority = n_total - n_minority

    minority_pool = pool[pool["label"] == 1]
    majority_pool = pool[pool["label"] == 0]

    minority_replace = len(minority_pool) < n_minority
    majority_replace = len(majority_pool) < n_majority

    minority_sample = minority_pool.sample(n=n_minority, replace=minority_replace, random_state=rng_state)
    majority_sample = majority_pool.sample(n=n_majority, replace=majority_replace, random_state=rng_state)

    out = pd.concat([minority_sample, majority_sample], ignore_index=True)
    out = out.sample(frac=1.0, random_state=rng_state).reset_index(drop=True)
    out.attrs["minority_bootstrapped"] = bool(minority_replace)
    out.attrs["majority_bootstrapped"] = bool(majority_replace)
    out.attrs["minority_ratio_requested"] = minority_ratio
    out.attrs["minority_available_in_pool"] = int(len(minority_pool))
    out.attrs["majority_available_in_pool"] = int(len(majority_pool))
    return out


IMBALANCE_CONFIGS = {
    "balanced": 0.50,
    "moderate_90_10": 0.10,
    "high_95_5": 0.05,
    "severe_99_1": 0.01,
}


def dataset_summary(df: pd.DataFrame) -> dict:
    n = len(df)
    n_drift = int((df["label"] == 1).sum())
    n_healthy = n - n_drift
    return {
        "n_rows": n,
        "n_healthy": n_healthy,
        "n_drift": n_drift,
        "drift_ratio": round(n_drift / n, 4) if n else 0.0,
        "n_episodes": int(df["episode_id"].nunique()) if "episode_id" in df else None,
        "drift_type_counts": df.loc[df["label"] == 1, "drift_type"].value_counts().to_dict(),
        "operating_condition_counts": df["operating_condition"].value_counts().to_dict(),
        "source_counts": df["source"].value_counts().to_dict(),
        "feature_columns": feature_columns(),
        "n_features": len(feature_columns()),
        "missing_values_total": int(df[feature_columns()].isna().sum().sum()),
        "duplicate_rows": int(df.duplicated(subset=feature_columns()).sum()),
    }
