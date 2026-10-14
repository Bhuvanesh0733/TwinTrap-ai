"""
fidelity.py
===========

Twin Fidelity Score
--------------------
Documented formula (spec section 18):

    normalized_discrepancy_i = min(|real_i - twin_i| / SCALE_i, 1.0)
    mean_normalized_discrepancy = mean over the 6 sensors (equal weights
                                    by default; WEIGHTS is configurable)
    TWIN FIDELITY (%) = 100 * (1 - mean_normalized_discrepancy)

SCALE_i is the per-sensor discrepancy magnitude treated as "complete
loss of fidelity" (normalized value = 1.0) for that channel. These
scales are calibrated from the same simulator fault-magnitude bounds
used in simulation/drift.py (MAX_FAULT_EFFECT), so a channel at its
worst injected fault severity drives that channel's normalized
discrepancy to (close to) 1.0.

Twin Fidelity is a deterministic function of the raw discrepancies —
it is NOT a random or invented percentage (spec section 18).

Drift Severity
--------------
Severity is derived from the ML model's predicted DRIFT probability
using the fixed thresholds in SEVERITY_THRESHOLDS below (spec section
19: "based on documented discrepancy ranges or ML probability... Do not
arbitrarily assign labels without documenting the threshold methodology").
"""

from typing import Dict

SCALE = {
    "temperature": 25.0,   # deg C
    "vibration": 3.0,      # mm/s
    "rpm": 300.0,          # rpm
    "current": 8.0,        # A
    "torque": 15.0,        # Nm
    "pressure": 2.0,       # bar
}

WEIGHTS = {k: 1.0 for k in SCALE}  # equal weighting by default

SEVERITY_THRESHOLDS = [
    (0.00, "HEALTHY"),
    (0.50, "LOW"),
    (0.65, "MEDIUM"),
    (0.80, "HIGH"),
    (0.95, "CRITICAL"),
]


def twin_fidelity(abs_diffs: Dict[str, float]) -> float:
    total_weight = sum(WEIGHTS.values())
    acc = 0.0
    for sensor, scale in SCALE.items():
        d = abs_diffs.get(sensor, 0.0)
        normalized = min(abs(d) / scale, 1.0)
        acc += WEIGHTS[sensor] * normalized
    mean_normalized = acc / total_weight
    fidelity_pct = 100.0 * (1.0 - mean_normalized)
    return round(max(0.0, min(100.0, fidelity_pct)), 2)


def drift_severity(drift_probability: float) -> str:
    label = "HEALTHY"
    for threshold, name in SEVERITY_THRESHOLDS:
        if drift_probability >= threshold:
            label = name
    return label


def severity_table() -> list:
    return [{"min_probability": t, "severity": n} for t, n in SEVERITY_THRESHOLDS]
