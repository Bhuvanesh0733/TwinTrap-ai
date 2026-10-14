from fastapi import APIRouter

from ..ml.classifiers import XGBOOST_AVAILABLE

router = APIRouter()


@router.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "TwinTrap AI backend",
        "xgboost_available": XGBOOST_AVAILABLE,
    }
