"""
simulator.py
============

TwinTrapSimulator ties together:
  * PhysicalMachine  (real system, machine.py)
  * DigitalTwin       (twin.py)
  * DriftController   (drift.py)

and produces, at every timestep, a fully-labeled record containing the
raw real/twin sensor values AND the discrepancy features that feed the
ML models (see section "Digital Twin Simulation" of the spec):

    absolute_difference, relative_difference, percentage_difference,
    rolling_difference, difference_velocity

This class is shared by:
  * the live "Simulation" page (one step per tick, streamed to the UI)
  * the dataset generator (many steps, batched into a DataFrame)

so the online and offline data are guaranteed to be produced by the exact
same generative process (no train/serve skew).
"""

from collections import deque
from typing import Deque, Dict, List, Optional

import numpy as np

from .physics import CFG, SENSOR_NAMES
from .machine import PhysicalMachine
from .twin import DigitalTwin
from .drift import DriftController

ROLLING_WINDOW = 10
EPS = 1e-6


class TwinTrapSimulator:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.machine = PhysicalMachine(seed=seed)
        self.twin = DigitalTwin(seed=seed + 1000)
        self.drift = DriftController()
        self._history: Dict[str, Deque[float]] = {s: deque(maxlen=ROLLING_WINDOW) for s in SENSOR_NAMES}
        self._last_abs_diff: Dict[str, float] = {s: 0.0 for s in SENSOR_NAMES}
        self.running = False

    def reset(self, seed: Optional[int] = None):
        seed = seed if seed is not None else self.seed
        self.seed = seed
        self.machine.reset(seed=seed)
        self.twin.reset(seed=seed + 1000)
        self.drift.reset()
        self._history = {s: deque(maxlen=ROLLING_WINDOW) for s in SENSOR_NAMES}
        self._last_abs_diff = {s: 0.0 for s in SENSOR_NAMES}
        self.running = False

    def inject(self, drift_type: str, severity: float = 1.0, profile: Optional[str] = None,
               ramp_steps: int = 150):
        self.drift.inject(drift_type, severity=severity, profile=profile, ramp_steps=ramp_steps)

    def clear_drift(self):
        self.drift.clear_faults()

    def step(self) -> Dict:
        effects = self.drift.channel_effects()
        real = self.machine.step(self.drift.regime, effects)
        twin = self.twin.step(real["load"])
        summary = self.drift.active_summary()
        self.drift.tick()

        record: Dict = {
            "step": self.drift.step,
            "load": real["load"],
            "source": "simulation",
        }

        for s in SENSOR_NAMES:
            real_v = real[s]
            twin_v = twin[s]
            abs_diff = abs(real_v - twin_v)
            rel_diff = abs_diff / (abs(real_v) + EPS)
            pct_diff = rel_diff * 100.0
            self._history[s].append(abs_diff)
            rolling_diff = float(np.mean(self._history[s])) if self._history[s] else abs_diff
            velocity = abs_diff - self._last_abs_diff[s]
            self._last_abs_diff[s] = abs_diff

            record[f"real_{s}"] = real_v
            record[f"twin_{s}"] = twin_v
            record[f"{s}_abs_diff"] = abs_diff
            record[f"{s}_rel_diff"] = rel_diff
            record[f"{s}_pct_diff"] = pct_diff
            record[f"{s}_rolling_diff"] = rolling_diff
            record[f"{s}_velocity"] = velocity

        record["drift_type"] = summary["drift_type"]
        record["drift_severity_value"] = summary["drift_severity_value"]
        record["operating_condition"] = summary["operating_condition"]
        record["label"] = summary["label"]
        return record


FEATURE_SUFFIXES = ["abs_diff", "rel_diff", "pct_diff", "rolling_diff", "velocity"]


def feature_columns() -> List[str]:
    return [f"{s}_{suf}" for s in SENSOR_NAMES for suf in FEATURE_SUFFIXES]
