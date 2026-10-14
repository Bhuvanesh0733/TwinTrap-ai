from fastapi import APIRouter, HTTPException

from ..models.schemas import DriftInjectRequest, SimulationResetRequest
from ..services.state import STATE
from ..simulation.drift import DRIFT_TYPES

router = APIRouter()


@router.post("/api/simulation/start")
def start_simulation():
    STATE.sim_running = True
    return {"running": True}


@router.post("/api/simulation/pause")
def pause_simulation():
    STATE.sim_running = False
    return {"running": False}


@router.post("/api/simulation/reset")
def reset_simulation(body: SimulationResetRequest):
    STATE.simulator.reset(seed=body.seed)
    STATE.sim_history.clear()
    STATE.sim_running = False
    return {"status": "reset"}


@router.post("/api/simulation/drift")
def inject_drift(body: DriftInjectRequest):
    if body.drift_type not in DRIFT_TYPES:
        raise HTTPException(status_code=400, detail=f"drift_type must be one of {DRIFT_TYPES}")
    try:
        STATE.simulator.inject(body.drift_type, severity=body.severity, profile=body.profile,
                                ramp_steps=body.ramp_steps)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "injected", "drift_type": body.drift_type, "severity": body.severity}


@router.post("/api/simulation/clear-drift")
def clear_drift():
    STATE.simulator.clear_drift()
    return {"status": "cleared"}


@router.get("/api/current-state")
def current_state():
    """
    Returns the current dashboard snapshot. If the simulation is running,
    this call also ADVANCES the simulation by one step (the frontend
    polls this endpoint on an interval to drive the live charts).
    """
    if STATE.sim_running:
        record = STATE.simulator.step()
        STATE.sim_history.append(record)
    elif STATE.sim_history:
        record = STATE.sim_history[-1]
    else:
        record = STATE.simulator.step()
        STATE.sim_history.append(record)
        STATE.sim_running = False

    scored = STATE.score_live_record(record)

    return {
        "running": STATE.sim_running,
        "step": record["step"],
        "load": round(record["load"], 4),
        "real": {s: round(record[f"real_{s}"], 3) for s in ["temperature", "vibration", "rpm", "current", "torque", "pressure"]},
        "twin": {s: round(record[f"twin_{s}"], 3) for s in ["temperature", "vibration", "rpm", "current", "torque", "pressure"]},
        "discrepancy_pct": {s: round(record[f"{s}_pct_diff"], 3) for s in ["temperature", "vibration", "rpm", "current", "torque", "pressure"]},
        "discrepancy_abs": {s: round(record[f"{s}_abs_diff"], 4) for s in ["temperature", "vibration", "rpm", "current", "torque", "pressure"]},
        **scored,
        "history_length": len(STATE.sim_history),
    }


@router.get("/api/simulation/history")
def simulation_history(n: int = 120):
    items = list(STATE.sim_history)[-n:]
    sensors = ["temperature", "vibration", "rpm", "current", "torque", "pressure"]
    out = []
    for r in items:
        row = {"step": r["step"], "label": r["label"], "drift_type": r["drift_type"]}
        for s in sensors:
            row[f"real_{s}"] = round(r[f"real_{s}"], 3)
            row[f"twin_{s}"] = round(r[f"twin_{s}"], 3)
        out.append(row)
    return {"history": out}


@router.get("/api/simulation/drift-types")
def drift_types():
    return {"drift_types": DRIFT_TYPES}
