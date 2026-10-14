"""
mobile_state.py
=================

In-memory registry of connected smartphone sessions, keyed by device_id.
Mirrors the pattern used by services/state.py for the industrial mode,
kept deliberately separate (spec: "do not create two separate
unnecessary ML systems" refers to the DETECTION *pipeline shape*, not to
sharing mutable state between two physically different feature spaces).
"""

import time
from typing import Dict, Optional

import numpy as np

from ..simulation.mobile_twin import MobileTwinSession, MobileDriftState


class MobileState:
    def __init__(self):
        self.sessions: Dict[str, MobileTwinSession] = {}
        self.active_device_id: Optional[str] = None
        self.rng = np.random.default_rng(123)

    def get_or_create(self, device_id: str) -> MobileTwinSession:
        if device_id not in self.sessions:
            self.sessions[device_id] = MobileTwinSession(device_id=device_id)
        self.active_device_id = device_id
        return self.sessions[device_id]

    def get(self, device_id: Optional[str] = None) -> Optional[MobileTwinSession]:
        did = device_id or self.active_device_id
        if did is None:
            return None
        return self.sessions.get(did)

    def list_devices(self):
        now = time.time()
        out = []
        for did, s in self.sessions.items():
            out.append({
                "device_id": did,
                "connected": s.connected and (now - s.last_seen) < 5.0,
                "last_seen_seconds_ago": round(now - s.last_seen, 1) if s.last_seen else None,
                "calibrated": s.calibrated,
                "packet_count": s.packet_count,
                "is_active": did == self.active_device_id,
            })
        return out

    def mark_stale_disconnected(self, timeout_seconds: float = 5.0):
        now = time.time()
        for s in self.sessions.values():
            if s.last_seen and (now - s.last_seen) > timeout_seconds:
                s.connected = False


MOBILE_STATE = MobileState()
