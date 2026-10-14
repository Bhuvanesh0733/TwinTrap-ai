"""
twin.py
=======

DigitalTwin simulates the machine's computational twin: a simplified,
linearized model of the same system implemented in machine.py.

Crucially, the twin:
  * never receives fault/drift information (it has no idea the real
    machine is degraded — exactly like a real digital twin)
  * omits the non-linear correction terms (rpm_nonlinear, torque_nonlinear,
    current_nonlinear) that the real machine has. These terms are small
    near the twin's calibration point ("idle"/"normal" regimes) and grow
    larger outside it — this is what "operating_condition" drift exploits.
  * has its own (separate) thermal integrator seeded from the same
    ambient temperature, driven by the twin's own idealized current
    estimate rather than the real (possibly faulty) current.

The twin is a MODEL, not a sensor: its outputs are simulated *predictions*,
not raw measurements, and therefore carry no measurement noise term
(they are deterministic given the load), aside from a very small epistemic
jitter representing residual numerical/model uncertainty.
"""

import numpy as np

from .physics import CFG


class DigitalTwin:
    def __init__(self, seed: int = 4242, epistemic_noise: float = 0.15):
        self.rng = np.random.default_rng(seed)
        self.temperature = CFG.ambient_temperature
        self.epistemic_noise = epistemic_noise  # scales down measurement-like noise

    def reset(self, seed: int = None):
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        self.temperature = CFG.ambient_temperature

    def step(self, load: float) -> dict:
        """Advance the twin by one timestep given the (shared) commanded load."""
        L = load
        k = self.epistemic_noise

        rpm = CFG.rpm_base + CFG.rpm_gain * L + self.rng.normal(0, CFG.rpm_noise_std * k)
        rpm = max(rpm, 0.0)

        torque = CFG.torque_base + CFG.torque_gain * L + self.rng.normal(0, CFG.torque_noise_std * k)
        torque = max(torque, 0.0)

        current = CFG.current_base + CFG.current_gain * torque + self.rng.normal(0, CFG.current_noise_std * k)
        current = max(current, 0.0)

        vibration = (
            CFG.vibration_base
            + CFG.vibration_rpm_gain * (rpm / CFG.rpm_max_ref) ** 2
            + CFG.vibration_load_gain * L
            + self.rng.normal(0, CFG.vibration_noise_std * k)
        )
        vibration = max(vibration, 0.0)

        heat_in = CFG.heat_coefficient * current ** 2
        cool_out = CFG.cooling_coefficient * (self.temperature - CFG.ambient_temperature)
        self.temperature = self.temperature + CFG.dt * (heat_in - cool_out) + self.rng.normal(0, CFG.temperature_noise_std * k)
        self.temperature = float(np.clip(self.temperature, CFG.ambient_temperature - 2, 220))

        pressure = (
            CFG.pressure_base
            + CFG.pressure_load_gain * L
            + CFG.pressure_temperature_gain * (self.temperature - CFG.ambient_temperature)
            + self.rng.normal(0, CFG.pressure_noise_std * k)
        )
        pressure = max(pressure, 0.0)

        return {
            "rpm": rpm,
            "torque": torque,
            "current": current,
            "vibration": vibration,
            "temperature": self.temperature,
            "pressure": pressure,
        }
