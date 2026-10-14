"""
physics.py
==========

Documented, physically-motivated constants and equations for the simulated
industrial motor used throughout TwinTrap AI.

IMPORTANT (see docs/methodology.md, section "Data Generation"):
This is a SIMULATED machine, not measurements from a real physical asset.
No public dataset was found (see docs/research_gap.md and README §Dataset)
that provides *paired* physical-system / digital-twin sensor streams with
controllable, labeled drift events, which is what this project needs to
train and evaluate a drift-detector. We therefore implement a documented,
non-trivial simulation whose sensor channels are coupled through the
equations below rather than sampled independently at random.

Design principle
-----------------
The Digital Twin is intentionally a *simplified / linearized* model of the
real machine. The real machine follows a richer, mildly non-linear model.
This mirrors real digital-twin practice: twins are reduced-order models
that are good approximations near the operating point they were calibrated
for, and lose fidelity (a) as unmodeled physical effects grow (naturally,
at high load) and (b) when real-world faults / sensor issues appear that
the twin's model does not know about. Both effects are implemented below.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PhysicsConfig:
    # --- Load dynamics -----------------------------------------------
    # Load L in [0, 1] follows a mean-reverting random walk toward a
    # regime-dependent setpoint (see simulation/machine.py).
    load_noise_std: float = 0.02

    # --- RPM ------------------------------------------------------------
    rpm_base: float = 1500.0          # idle RPM
    rpm_gain: float = 1300.0          # linear gain w.r.t. load (both twin & real)
    rpm_nonlinear: float = -150.0     # UNMODELED saturation term (real only)
    rpm_max_ref: float = 3000.0       # normalization reference for vibration eq.
    rpm_noise_std: float = 8.0

    # --- Torque -----------------------------------------------------
    torque_base: float = 15.0
    torque_gain: float = 55.0
    torque_nonlinear: float = 8.0     # UNMODELED mechanical-loss term (real only)
    torque_noise_std: float = 1.0

    # --- Current ------------------------------------------------------
    current_base: float = 3.0
    current_gain: float = 0.35        # current ~ proportional to torque
    current_nonlinear: float = 0.02   # UNMODELED iron-loss term (real only)
    current_noise_std: float = 0.3

    # --- Vibration ------------------------------------------------------
    vibration_base: float = 0.15
    vibration_rpm_gain: float = 3.0   # grows with (rpm / rpm_max_ref)^2
    vibration_load_gain: float = 0.6
    vibration_noise_std: float = 0.05

    # --- Temperature (first-order thermal lag) ---------------------------
    ambient_temperature: float = 25.0
    heat_coefficient: float = 0.0027  # heat generated ~ current^2
    cooling_coefficient: float = 0.04  # Newton cooling toward ambient
    temperature_noise_std: float = 0.3
    dt: float = 1.0                    # seconds per simulation step

    # --- Pressure -------------------------------------------------------
    pressure_base: float = 3.0
    pressure_load_gain: float = 3.5
    pressure_temperature_gain: float = 0.008  # per degree above ambient
    pressure_noise_std: float = 0.08

    # --- Operating regimes (setpoints for the load random walk) --------
    regimes = {
        "idle":      {"target": 0.08, "spread": 0.05},
        "normal":    {"target": 0.50, "spread": 0.15},
        "high_load": {"target": 0.92, "spread": 0.05},
    }
    # The Digital Twin's linear model is calibrated using the "normal"
    # regime. "idle" is a safe low-load subset of that same envelope.
    # "high_load" pushes the machine outside the calibration envelope,
    # which is used to simulate an "operating condition shift" drift
    # scenario (see simulation/drift.py).
    normal_envelope_regimes = ("idle", "normal")

    # --- Drift labeling threshold ----------------------------------------
    # A fault's effective magnitude m(t) in [0, 1] must exceed this value
    # before a sample is labeled DRIFT (1). Below it, the twin is still
    # considered synchronized even though a fault process may be ramping
    # up (e.g. early stage of a gradual drift). This threshold is the
    # single source of truth for ground-truth labeling and is documented
    # in docs/methodology.md.
    drift_label_threshold: float = 0.15


CFG = PhysicsConfig()

SENSOR_NAMES = ["temperature", "vibration", "rpm", "current", "torque", "pressure"]
