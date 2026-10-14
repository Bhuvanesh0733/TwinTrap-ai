"""
mobile_twin.py
================

"Smartphone Cyber-Physical Demonstration" (see docs/methodology.md).

This is a SEPARATE, clearly-scoped pipeline from the industrial-motor
simulation — the feature schemas are not compatible (accelerometer /
gyroscope vs temperature / vibration / rpm / current / torque /
pressure), so per spec section 9 of the smartphone extension we never
apply the industrial model to phone data. Instead each phone session
gets its own lightweight MobileTwinSession.

Pipeline per connected device:

  Raw packet (accel_x/y/z, gyro_alpha/beta/gamma, timestamp)
        -> SIMULATED DRIFT LAYER (optional, server-side, clearly labeled)
        -> derived features (magnitudes, rolling mean/std, rate of change)
        -> CALIBRATION: first `duration_seconds` of packets after
           "Calibrate Twin" establish the Digital Twin's EXPECTED STATE
           (per-feature mean/std of the stationary phone)
        -> discrepancy features vs the calibrated expected state
        -> Twin Fidelity Score (same documented formula family as the
           industrial twin, see utils/fidelity.py, re-parameterized for
           phone feature scales)
        -> Smartphone Divergence Model: a small classifier trained,
           immediately after calibration, on SYNTHETIC samples drawn
           from the phone's OWN calibration statistics (normal ~
           N(baseline_mean, baseline_std)) vs documented synthetic
           divergence archetypes (bias / spike / gradual / noise /
           multi-sensor) offset from that same baseline. This is
           explicitly NOT a claim of learning from real labeled drift
           events (none exist for an ad-hoc phone demo) — it is a
           per-session, statistically-grounded classifier, and is
           labeled as such everywhere it is surfaced in the UI.
"""

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional

import numpy as np
from sklearn.ensemble import RandomForestClassifier

RAW_CHANNELS = ["accel_x", "accel_y", "accel_z", "gyro_alpha", "gyro_beta", "gyro_gamma"]
DERIVED_CHANNELS = ["accel_magnitude", "gyro_magnitude"]
ALL_CHANNELS = RAW_CHANNELS + DERIVED_CHANNELS
ROLLING_WINDOW = 20

# Fidelity scale: discrepancy (in standard-deviations-from-baseline units)
# is given a "free zone" of FREE_ZONE_STD (typical measurement noise) with
# no fidelity penalty, then ramps linearly to a full loss of fidelity for
# that channel at FULL_LOSS_STD. A flat |Z|-based scale (no free zone)
# would penalize a perfectly healthy stationary phone by ~20% on average,
# because E[|Z|] for standard-normal noise is already ~0.8 — the free
# zone corrects for that so a truly stationary phone reports fidelity in
# the mid-to-high 90s, matching the documented 90-100% "SYNCHRONIZED"
# band below.
FREE_ZONE_STD = 1.2
FULL_LOSS_STD = 6.0

SEVERITY_BANDS = [  # (min_fidelity_pct, label) — doc section 8, configurable
    (90.0, "SYNCHRONIZED"),
    (70.0, "MINOR_DIVERGENCE"),
    (40.0, "SIGNIFICANT_DIVERGENCE"),
    (0.0, "CRITICAL_DIVERGENCE"),
]

DRIFT_TYPES = ["bias", "spike", "gradual", "noise", "multi_sensor"]


def severity_from_fidelity(fidelity_pct: float) -> str:
    for threshold, label in SEVERITY_BANDS:
        if fidelity_pct >= threshold:
            return label
    return "CRITICAL_DIVERGENCE"


@dataclass
class MobileDriftState:
    drift_type: Optional[str] = None
    severity: float = 0.0
    channel: Optional[str] = None
    start_time: float = 0.0
    active: bool = False

    def magnitude(self) -> float:
        if not self.active:
            return 0.0
        if self.drift_type == "gradual":
            elapsed = time.time() - self.start_time
            return float(min(elapsed / 20.0, 1.0)) * self.severity  # ramps over ~20s
        return self.severity


def _derive(raw: Dict[str, float]) -> Dict[str, float]:
    out = dict(raw)
    out["accel_magnitude"] = float(np.sqrt(raw["accel_x"] ** 2 + raw["accel_y"] ** 2 + raw["accel_z"] ** 2))
    out["gyro_magnitude"] = float(np.sqrt(raw["gyro_alpha"] ** 2 + raw["gyro_beta"] ** 2 + raw["gyro_gamma"] ** 2))
    return out


def _apply_drift_layer(values: Dict[str, float], drift: MobileDriftState, rng: np.random.Generator,
                        baseline_std: Optional[Dict[str, float]] = None) -> Dict[str, float]:
    """Applies a clearly-labeled SIMULATED drift on top of the real, incoming
    phone values. This never mutates the raw packet the phone actually sent —
    callers keep both the real observation and this modified one.

    Drift magnitude is expressed in units of the DEVICE'S OWN CALIBRATED
    STANDARD DEVIATION per channel (falling back to a documented typical
    noise level before calibration), rather than a fixed physical unit.
    This keeps the severity -> divergence-band mapping consistent no
    matter how noisy/quiet a particular phone or resting surface is, and
    produces a clean staged SYNCHRONIZED -> MINOR -> SIGNIFICANT ->
    CRITICAL progression as a gradual drift ramps up (see fidelity bands
    in this module: FREE_ZONE_STD / FULL_LOSS_STD).
    """
    if not drift.active or drift.drift_type is None:
        return dict(values)

    fallback_std = {"accel_x": 0.05, "accel_y": 0.05, "accel_z": 0.05,
                     "gyro_alpha": 0.02, "gyro_beta": 0.02, "gyro_gamma": 0.02}
    std = baseline_std or fallback_std

    m = drift.magnitude()
    out = dict(values)
    targets = [drift.channel] if drift.channel and drift.channel in RAW_CHANNELS else RAW_CHANNELS

    MAX_STD_SHIFT = 8.0    # magnitude=1.0 -> ~8 std shift (well past FULL_LOSS_STD)
    SPIKE_STD_SHIFT = 14.0
    NOISE_STD_MULT = 3.0

    if drift.drift_type in ("bias", "gradual"):
        for ch in targets:
            out[ch] = out[ch] + m * MAX_STD_SHIFT * std.get(ch, fallback_std[ch])
    elif drift.drift_type == "spike":
        for ch in targets:
            if rng.random() < 0.3:
                out[ch] = out[ch] + m * SPIKE_STD_SHIFT * std.get(ch, fallback_std[ch])
    elif drift.drift_type == "noise":
        for ch in RAW_CHANNELS:
            out[ch] = out[ch] + rng.normal(0, m * NOISE_STD_MULT * std.get(ch, fallback_std[ch]))
    elif drift.drift_type == "multi_sensor":
        for ch in RAW_CHANNELS:
            sign = 1 if rng.random() < 0.5 else -1
            out[ch] = out[ch] + sign * m * (MAX_STD_SHIFT * 0.6) * std.get(ch, fallback_std[ch])

    return _derive(out)


def _train_synthetic_divergence_model(baseline_mean: Dict[str, float], baseline_std: Dict[str, float],
                                       seed: int = 42):
    """
    Trains the small "Smartphone Divergence Model" from SYNTHETIC samples
    anchored to this device's own calibration statistics (see module
    docstring). Returns (model, feature_order).
    """
    rng = np.random.default_rng(seed)
    feature_order = ALL_CHANNELS
    n_per_class = 600
    rows, labels = [], []

    std = {k: max(baseline_std.get(k, 0.01), 1e-3) for k in feature_order}
    mean = {k: baseline_mean.get(k, 0.0) for k in feature_order}

    # class 0: synchronized — normal fluctuation around baseline
    for _ in range(n_per_class):
        row = {k: rng.normal(mean[k], std[k]) for k in feature_order}
        rows.append(row); labels.append(0)

    # class 1: divergent — one of the documented archetypes applied
    archetypes = ["bias", "spike", "gradual", "noise", "multi_sensor"]
    for _ in range(n_per_class):
        arche = archetypes[rng.integers(0, len(archetypes))]
        sev = float(rng.uniform(0.5, 1.0))
        row = {k: rng.normal(mean[k], std[k]) for k in feature_order}
        if arche == "bias":
            ch = feature_order[rng.integers(0, len(RAW_CHANNELS))]
            row[ch] += sev * 3.5 * std[ch] * 3
        elif arche == "spike":
            ch = feature_order[rng.integers(0, len(RAW_CHANNELS))]
            row[ch] += sev * 6.0 * std[ch] * 3
        elif arche == "gradual":
            ch = feature_order[rng.integers(0, len(RAW_CHANNELS))]
            row[ch] += sev * 2.5 * std[ch] * 3
        elif arche == "noise":
            for ch in RAW_CHANNELS:
                row[ch] += rng.normal(0, sev * std[ch] * 3)
        elif arche == "multi_sensor":
            for ch in RAW_CHANNELS:
                row[ch] += sev * (1 if rng.random() < 0.5 else -1) * std[ch] * 2
        row["accel_magnitude"] = float(np.sqrt(row["accel_x"] ** 2 + row["accel_y"] ** 2 + row["accel_z"] ** 2))
        row["gyro_magnitude"] = float(np.sqrt(row["gyro_alpha"] ** 2 + row["gyro_beta"] ** 2 + row["gyro_gamma"] ** 2))
        rows.append(row); labels.append(1)

    X = np.array([[r[k] for k in feature_order] for r in rows])
    y = np.array(labels)
    model = RandomForestClassifier(n_estimators=120, max_depth=6, random_state=seed, n_jobs=-1)
    model.fit(X, y)
    return model, feature_order


@dataclass
class MobileTwinSession:
    device_id: str
    connected: bool = False
    last_seen: float = 0.0
    raw_buffer: Deque[Dict] = field(default_factory=lambda: deque(maxlen=ROLLING_WINDOW))
    packet_count: int = 0

    calibrating: bool = False
    calibration_start: float = 0.0
    calibration_duration: float = 6.0
    calibration_buffer: List[Dict] = field(default_factory=list)
    calibrated: bool = False
    baseline_mean: Dict[str, float] = field(default_factory=dict)
    baseline_std: Dict[str, float] = field(default_factory=dict)

    drift: MobileDriftState = field(default_factory=MobileDriftState)
    model: object = None
    model_features: List[str] = field(default_factory=list)

    last_observed: Dict[str, float] = field(default_factory=dict)
    last_expected: Dict[str, float] = field(default_factory=dict)
    last_discrepancy: Dict[str, float] = field(default_factory=dict)
    last_fidelity: float = 100.0
    last_probability: float = 0.0
    last_severity: str = "SYNCHRONIZED"

    def start_calibration(self, duration_seconds: float = 6.0):
        self.calibrating = True
        self.calibration_start = time.time()
        self.calibration_duration = duration_seconds
        self.calibration_buffer = []
        self.calibrated = False

    def calibration_progress(self) -> float:
        if not self.calibrating:
            return 1.0 if self.calibrated else 0.0
        elapsed = time.time() - self.calibration_start
        return float(min(elapsed / self.calibration_duration, 1.0))

    def _finish_calibration(self):
        if len(self.calibration_buffer) < 5:
            # not enough packets yet; extend silently rather than crash
            self.calibration_duration += 2.0
            return
        arr = {k: np.array([p[k] for p in self.calibration_buffer]) for k in ALL_CHANNELS}
        self.baseline_mean = {k: float(v.mean()) for k, v in arr.items()}
        self.baseline_std = {k: float(max(v.std(), 1e-3)) for k, v in arr.items()}
        self.calibrating = False
        self.calibrated = True
        self.model, self.model_features = _train_synthetic_divergence_model(self.baseline_mean, self.baseline_std)

    def ingest(self, raw_packet: Dict, rng: np.random.Generator) -> Dict:
        self.connected = True
        self.last_seen = time.time()
        self.packet_count += 1

        raw = {k: float(raw_packet.get(k, 0.0)) for k in RAW_CHANNELS}
        observed_real = _derive(raw)

        drift_mag = self.drift.magnitude()
        observed = _apply_drift_layer(observed_real, self.drift, rng,
                                       baseline_std=self.baseline_std if self.calibrated else None) if self.drift.active else observed_real

        self.raw_buffer.append(observed)

        if self.calibrating:
            self.calibration_buffer.append(observed)
            if self.calibration_progress() >= 1.0:
                self._finish_calibration()

        self.last_observed = observed

        if not self.calibrated:
            self.last_expected = {k: observed.get(k, 0.0) for k in ALL_CHANNELS}
            self.last_discrepancy = {k: 0.0 for k in ALL_CHANNELS}
            self.last_fidelity = 100.0
            self.last_probability = 0.0
            self.last_severity = "NOT_CALIBRATED"
            return self._snapshot(observed_real, drift_mag)

        self.last_expected = dict(self.baseline_mean)
        discrepancy = {}
        normalized_acc = []
        for k in ALL_CHANNELS:
            d = abs(observed[k] - self.baseline_mean[k])
            discrepancy[k] = d
            z = d / self.baseline_std[k]
            normalized = float(np.clip((z - FREE_ZONE_STD) / (FULL_LOSS_STD - FREE_ZONE_STD), 0.0, 1.0))
            normalized_acc.append(normalized)
        self.last_discrepancy = discrepancy

        mean_normalized = float(np.mean(normalized_acc))
        self.last_fidelity = round(max(0.0, min(100.0, 100.0 * (1.0 - mean_normalized))), 2)
        self.last_severity = severity_from_fidelity(self.last_fidelity)

        if self.model is not None:
            x = np.array([[observed[k] for k in self.model_features]])
            self.last_probability = round(float(self.model.predict_proba(x)[0, 1]), 4)
        else:
            self.last_probability = round(1.0 - self.last_fidelity / 100.0, 4)

        return self._snapshot(observed_real, drift_mag)

    def _snapshot(self, observed_real: Dict, drift_mag: float) -> Dict:
        return {
            "device_id": self.device_id,
            "connected": self.connected,
            "packet_count": self.packet_count,
            "calibrated": self.calibrated,
            "calibrating": self.calibrating,
            "calibration_progress": round(self.calibration_progress(), 3),
            "observed_real": {k: round(v, 4) for k, v in observed_real.items()},
            "observed": {k: round(v, 4) for k, v in self.last_observed.items()},
            "expected": {k: round(v, 4) for k, v in self.last_expected.items()},
            "discrepancy": {k: round(v, 4) for k, v in self.last_discrepancy.items()},
            "twin_fidelity": self.last_fidelity,
            "divergence_probability": self.last_probability,
            "severity": self.last_severity,
            "status": "SYNCHRONIZED" if self.last_severity in ("SYNCHRONIZED",) else (
                "NOT_CALIBRATED" if self.last_severity == "NOT_CALIBRATED" else "DIVERGENT"
            ),
            "drift_injection": {
                "active": self.drift.active,
                "drift_type": self.drift.drift_type,
                "magnitude": round(drift_mag, 4),
                "label": "SIMULATED SENSOR DRIFT" if self.drift.active else None,
            },
            "model_available": self.model is not None,
        }
