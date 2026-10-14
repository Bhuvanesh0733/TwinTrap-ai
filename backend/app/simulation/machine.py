"""
machine.py
==========

PhysicalMachine simulates the REAL industrial motor. It follows the
richer, mildly non-linear equations described in physics.py and is the
only place where injected faults (from drift.py) are applied.

All values returned by `.step()` are SIMULATED SENSOR MEASUREMENTS —
they represent what physical sensors bolted to the machine would report,
including their own measurement noise.
"""

import numpy as np

from .physics import CFG


class PhysicalMachine:
    def __init__(self, seed: int = 42):
        self.rng = np.random.default_rng(seed)
        self.temperature = CFG.ambient_temperature
        self.load = CFG.regimes["normal"]["target"]

    def reset(self, seed: int = None):
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        self.temperature = CFG.ambient_temperature
        self.load = CFG.regimes["normal"]["target"]

    def step_load(self, regime: str) -> float:
        target = CFG.regimes[regime]["target"]
        spread = CFG.regimes[regime]["spread"]
        pull = 0.08 * (target - self.load)
        noise = self.rng.normal(0, CFG.load_noise_std)
        self.load = float(np.clip(self.load + pull + noise, 0.0, 1.0))
        # keep load loosely within the regime's plausible spread of its target
        self.load = float(np.clip(self.load, max(0.0, target - 3 * spread), min(1.0, target + 3 * spread)))
        return self.load

    def step(self, regime: str, channel_effects: dict) -> dict:
        """Advance the real machine by one timestep and return sensor readings."""
        noise_mult = channel_effects.get("noise_mult", 1.0)
        L = self.step_load(regime)

        rpm = (
            CFG.rpm_base
            + CFG.rpm_gain * L
            + CFG.rpm_nonlinear * L ** 2
            + channel_effects.get("rpm_bias", 0.0)
            + self.rng.normal(0, CFG.rpm_noise_std * noise_mult)
        )
        rpm = max(rpm, 0.0)

        torque = (
            CFG.torque_base
            + CFG.torque_gain * L
            + CFG.torque_nonlinear * L ** 3
            + channel_effects.get("torque_bias", 0.0)
            + self.rng.normal(0, CFG.torque_noise_std * noise_mult)
        )
        torque = max(torque, 0.0)

        current = (
            CFG.current_base
            + CFG.current_gain * torque
            + CFG.current_nonlinear * (torque ** 2) / 100.0
            + channel_effects.get("current_bias", 0.0)
            + self.rng.normal(0, CFG.current_noise_std * noise_mult)
        )
        current = max(current, 0.0)

        vibration_nominal = (
            CFG.vibration_base
            + CFG.vibration_rpm_gain * (rpm / CFG.rpm_max_ref) ** 2
            + CFG.vibration_load_gain * L
        )
        vibration = (
            vibration_nominal * channel_effects.get("vibration_mult", 1.0)
            + self.rng.normal(0, CFG.vibration_noise_std * noise_mult)
        )
        vibration = max(vibration, 0.0)

        # Temperature faults (e.g. degraded cooling / thermal insulation
        # breakdown) are modeled as an EXTRA HEAT-GENERATION RATE, not an
        # instantaneous sensor offset, because temperature is itself the
        # state of a first-order thermal integrator. A constant fault
        # magnitude therefore produces a continuously climbing temperature
        # (a realistic "runaway" fault signature) until the machine hits
        # the clamp below, which stands in for a thermal safety cutoff.
        # The /60 factor converts the fault's [0, MAX_FAULT_EFFECT] scale
        # into a per-step heating-rate contribution rather than a one-shot
        # jump, so a "sudden" temperature fault still ramps visibly over
        # a handful of steps instead of teleporting the reading.
        heat_in = CFG.heat_coefficient * current ** 2
        cool_out = CFG.cooling_coefficient * (self.temperature - CFG.ambient_temperature)
        fault_heat_rate = channel_effects.get("temperature_bias", 0.0) / 60.0
        self.temperature = (
            self.temperature
            + CFG.dt * (heat_in - cool_out)
            + fault_heat_rate * CFG.dt
            + self.rng.normal(0, CFG.temperature_noise_std * noise_mult)
        )
        self.temperature = float(np.clip(self.temperature, CFG.ambient_temperature - 2, 220))

        pressure = (
            CFG.pressure_base
            + CFG.pressure_load_gain * L
            + CFG.pressure_temperature_gain * (self.temperature - CFG.ambient_temperature)
            + channel_effects.get("pressure_bias", 0.0)
            + self.rng.normal(0, CFG.pressure_noise_std * noise_mult)
        )
        pressure = max(pressure, 0.0)

        return {
            "load": L,
            "rpm": rpm,
            "torque": torque,
            "current": current,
            "vibration": vibration,
            "temperature": self.temperature,
            "pressure": pressure,
        }
