"""
drift.py
========

Implements the controllable Digital-Twin divergence ("drift") scenarios
required by the assignment:

    A. gradual          - fault ramps up slowly over many steps
    B. sudden            - fault jumps to full severity instantly
    C. temperature        - only the temperature channel is affected
    D. vibration          - only the vibration channel is affected
    E. rpm                 - only the rpm channel is affected
    F. multi_sensor       - several channels affected simultaneously
    G. noise               - sensor noise std increases
    H. operating_condition - machine moves to an out-of-envelope regime

A DriftEvent is applied to the REAL machine only. The Digital Twin's model
never sees the fault, which is exactly why divergence appears: the twin
keeps predicting from its unchanged, idealized equations while the real
machine's behaviour has changed underneath it.

Every fault has an effective, time-varying magnitude m(t) in [0, 1]:

    gradual event:  m(t) = severity * clip((t - start) / ramp_steps, 0, 1)
    sudden  event:  m(t) = severity                     for t >= start
                    m(t) = 0                              otherwise

A sample is labeled DRIFT (y=1) iff m(t) > CFG.drift_label_threshold, i.e.
the fault has become large enough to be considered an unsynchronized twin.
This threshold is documented in physics.py / docs/methodology.md and is
the single source of truth for ground-truth labels — it is never chosen
per-sample or adjusted to make results look better.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .physics import CFG

DRIFT_TYPES = [
    "gradual",
    "sudden",
    "temperature",
    "vibration",
    "rpm",
    "multi_sensor",
    "noise",
    "operating_condition",
]

# Maximum fault magnitude applied to each channel at m(t) = 1.0.
# These bounds are what turn an abstract severity in [0,1] into a
# physically-sized disturbance. Documented in docs/methodology.md.
MAX_FAULT_EFFECT = {
    "temperature_bias": 30.0,       # deg C additive bias
    "vibration_mult": 2.5,          # multiplicative factor (up to +250%)
    "rpm_bias": -350.0,             # RPM additive bias (controller slip)
    "current_bias": 9.0,            # Amps additive bias (winding fault)
    "torque_bias": 18.0,            # Nm additive bias
    "pressure_bias": 2.0,           # bar additive bias
    "noise_mult": 4.0,              # multiplies the baseline noise std
}

# Which channels each drift TYPE is allowed to touch.
DRIFT_CHANNELS = {
    "gradual": ["temperature", "vibration", "current"],
    "sudden": ["temperature", "vibration", "current"],
    "temperature": ["temperature"],
    "vibration": ["vibration"],
    "rpm": ["rpm"],
    "multi_sensor": ["temperature", "vibration", "rpm", "current"],
    "noise": ["noise"],
    "operating_condition": [],  # handled structurally, not via fault channels
}


@dataclass
class DriftEvent:
    drift_type: str
    start_step: int
    severity: float = 1.0          # peak severity in (0, 1]
    ramp_steps: int = 150          # only used when profile == "gradual"
    profile: str = "gradual"       # "gradual" or "sudden"
    active: bool = True

    def magnitude(self, step: int) -> float:
        if not self.active or step < self.start_step:
            return 0.0
        if self.profile == "sudden":
            return self.severity
        # gradual ramp
        progress = min(max((step - self.start_step) / max(self.ramp_steps, 1), 0.0), 1.0)
        return self.severity * progress

    def is_labeled_drift(self, step: int) -> bool:
        return self.magnitude(step) > CFG.drift_label_threshold


class DriftController:
    """Owns zero-or-more simultaneous DriftEvents and the operating regime."""

    def __init__(self):
        self.events: List[DriftEvent] = []
        self.regime: str = "normal"
        self._step: int = 0

    def reset(self):
        self.events = []
        self.regime = "normal"
        self._step = 0

    def tick(self):
        self._step += 1

    @property
    def step(self) -> int:
        return self._step

    def inject(self, drift_type: str, severity: float = 1.0, profile: Optional[str] = None,
               ramp_steps: int = 150):
        if drift_type not in DRIFT_TYPES:
            raise ValueError(f"Unknown drift_type '{drift_type}'. Choose from {DRIFT_TYPES}")

        if drift_type == "operating_condition":
            self.regime = "high_load"
            return

        resolved_profile = profile or ("sudden" if drift_type == "sudden" else "gradual")
        event = DriftEvent(
            drift_type=drift_type,
            start_step=self._step,
            severity=float(min(max(severity, 0.0), 1.0)),
            ramp_steps=ramp_steps,
            profile=resolved_profile,
        )
        self.events.append(event)

    def clear_faults(self):
        self.events = []
        self.regime = "normal"

    def active_summary(self) -> Dict:
        """Returns the *dominant* (highest current magnitude) drift info for labeling."""
        best_type = "none"
        best_mag = 0.0
        for ev in self.events:
            m = ev.magnitude(self._step)
            if m > best_mag:
                best_mag = m
                best_type = ev.drift_type

        # Operating-condition shift is structural, not magnitude based: the
        # twin is considered out of its calibration envelope whenever the
        # machine is running in a regime outside CFG.normal_envelope_regimes
        # (e.g. "high_load"), regardless of any explicit fault event.
        out_of_envelope = self.regime not in CFG.normal_envelope_regimes
        if out_of_envelope and best_mag <= CFG.drift_label_threshold:
            best_type = "operating_condition"
            best_mag = 1.0  # fully "active" whenever out of envelope

        is_drift = (best_mag > CFG.drift_label_threshold) or out_of_envelope
        return {
            "drift_type": best_type if is_drift else "none",
            "drift_severity_value": round(float(best_mag), 4),
            "operating_condition": self.regime,
            "label": int(is_drift),
        }

    def channel_effects(self) -> Dict[str, float]:
        """Aggregate additive/multiplicative fault effects per channel for THIS step."""
        effects = {
            "temperature_bias": 0.0,
            "vibration_mult": 1.0,
            "rpm_bias": 0.0,
            "current_bias": 0.0,
            "torque_bias": 0.0,
            "pressure_bias": 0.0,
            "noise_mult": 1.0,
        }
        for ev in self.events:
            m = ev.magnitude(self._step)
            if m <= 0:
                continue
            channels = DRIFT_CHANNELS.get(ev.drift_type, [])
            if "temperature" in channels:
                effects["temperature_bias"] += m * MAX_FAULT_EFFECT["temperature_bias"]
            if "vibration" in channels:
                effects["vibration_mult"] += m * (MAX_FAULT_EFFECT["vibration_mult"] - 1.0)
            if "rpm" in channels:
                effects["rpm_bias"] += m * MAX_FAULT_EFFECT["rpm_bias"]
            if "current" in channels:
                effects["current_bias"] += m * MAX_FAULT_EFFECT["current_bias"]
                effects["torque_bias"] += m * MAX_FAULT_EFFECT["torque_bias"] * 0.5
            if ev.drift_type == "noise":
                effects["noise_mult"] += m * (MAX_FAULT_EFFECT["noise_mult"] - 1.0)
        return effects
