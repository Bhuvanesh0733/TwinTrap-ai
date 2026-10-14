"""
mobile.py (API)
=================

Real-time endpoints for the Smartphone Live Twin mode:
  * WS   /ws/mobile-sensor      - phone streams raw sensor packets here
  * REST /api/mobile/*          - desktop dashboard reads/controls state

The WebSocket handler never lets a malformed packet or a mid-stream
disconnect crash the backend (spec: "Do not crash the backend if the
phone disconnects" / "Handle ... malformed packets").
"""

import numpy as np
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from ..models.schemas import MobileCalibrateRequest, MobileDriftRequest, MobileResetRequest
from ..services.mobile_state import MOBILE_STATE
from ..simulation.mobile_twin import DRIFT_TYPES, RAW_CHANNELS, MobileDriftState
from ..ml.shap_explain import local_explanation

router = APIRouter()


@router.websocket("/ws/mobile-sensor")
async def mobile_sensor_ws(websocket: WebSocket):
    await websocket.accept()
    device_id = None
    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                raise
            except Exception:
                # malformed JSON / non-JSON frame - tell the client, keep the connection alive
                try:
                    await websocket.send_json({"type": "error", "message": "malformed_packet_ignored"})
                except Exception:
                    pass
                continue

            try:
                device_id = str(data.get("device_id") or device_id or "phone-01")
                session = MOBILE_STATE.get_or_create(device_id)
                snapshot = session.ingest(data, MOBILE_STATE.rng)
                await websocket.send_json({"type": "state", **snapshot})
            except Exception as e:
                try:
                    await websocket.send_json({"type": "error", "message": f"processing_error: {e}"})
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        if device_id and device_id in MOBILE_STATE.sessions:
            MOBILE_STATE.sessions[device_id].connected = False


@router.get("/api/mobile/devices")
def list_devices():
    MOBILE_STATE.mark_stale_disconnected()
    return {"devices": MOBILE_STATE.list_devices(), "active_device_id": MOBILE_STATE.active_device_id}


@router.get("/api/mobile/state")
def mobile_state(device_id: str = Query(None)):
    MOBILE_STATE.mark_stale_disconnected()
    session = MOBILE_STATE.get(device_id)
    if session is None:
        return {
            "connected": False,
            "message": "No smartphone has connected yet. Open /mobile on your phone and press Start Telemetry.",
        }
    now_connected = session.connected
    return {**session._snapshot(session.last_observed or {k: 0.0 for k in session.model_features or []},
                                 session.drift.magnitude()), "connected": now_connected}


@router.post("/api/mobile/calibrate")
def calibrate(body: MobileCalibrateRequest):
    session = MOBILE_STATE.get_or_create(body.device_id)
    session.start_calibration(duration_seconds=body.duration_seconds)
    return {"status": "calibrating", "device_id": body.device_id, "duration_seconds": body.duration_seconds}


@router.get("/api/mobile/calibrate/status")
def calibrate_status(device_id: str = Query(None)):
    session = MOBILE_STATE.get(device_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown device_id / no session yet.")
    return {
        "device_id": session.device_id,
        "calibrating": session.calibrating,
        "calibrated": session.calibrated,
        "progress": round(session.calibration_progress(), 3),
    }


@router.post("/api/mobile/drift")
def inject_drift(body: MobileDriftRequest):
    if body.drift_type not in DRIFT_TYPES:
        raise HTTPException(status_code=400, detail=f"drift_type must be one of {DRIFT_TYPES}")
    if body.channel and body.channel not in RAW_CHANNELS:
        raise HTTPException(status_code=400, detail=f"channel must be one of {RAW_CHANNELS}")
    session = MOBILE_STATE.get(body.device_id)
    if session is None:
        raise HTTPException(status_code=404, detail="No connected device to inject drift into.")
    import time as _time
    session.drift = MobileDriftState(drift_type=body.drift_type, severity=body.severity,
                                      channel=body.channel, start_time=_time.time(), active=True)
    return {"status": "injected", "label": "SIMULATED SENSOR DRIFT", "drift_type": body.drift_type,
            "severity": body.severity, "channel": body.channel}


@router.post("/api/mobile/drift/clear")
def clear_drift(device_id: str = Query(None)):
    session = MOBILE_STATE.get(device_id)
    if session is None:
        raise HTTPException(status_code=404, detail="No connected device.")
    session.drift = MobileDriftState()
    return {"status": "cleared"}


@router.post("/api/mobile/reset")
def reset_session(body: MobileResetRequest):
    did = body.device_id or MOBILE_STATE.active_device_id
    if did and did in MOBILE_STATE.sessions:
        del MOBILE_STATE.sessions[did]
        if MOBILE_STATE.active_device_id == did:
            MOBILE_STATE.active_device_id = None
    return {"status": "reset", "device_id": did}


@router.get("/api/mobile/shap")
def mobile_shap(device_id: str = Query(None)):
    session = MOBILE_STATE.get(device_id)
    if session is None or not session.calibrated or session.model is None:
        raise HTTPException(status_code=400, detail="Device must be connected and calibrated first.")

    # Build a small background set from recent buffer (or synthetic baseline noise)
    if len(session.raw_buffer) >= 5:
        bg = np.array([[p[k] for k in session.model_features] for p in session.raw_buffer])
    else:
        rng = np.random.default_rng(1)
        bg = np.array([[rng.normal(session.baseline_mean[k], session.baseline_std[k]) for k in session.model_features]
                        for _ in range(20)])

    current = np.array([session.last_observed.get(k, session.baseline_mean.get(k, 0.0)) for k in session.model_features])

    try:
        result = local_explanation(session.model, "random_forest", bg, current, session.model_features)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP explanation failed: {e}")
    result["device_id"] = session.device_id
    return result
