from fastapi import APIRouter, HTTPException, Query

from ..services.state import STATE
from ..ml.pca_svd import run_pca, run_svd
from ..ml.lda import run_lda

router = APIRouter()


@router.get("/api/pca")
def pca(dataset: str = Query("balanced")):
    try:
        prepared = STATE.get_prepared(dataset)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    result = run_pca(prepared.X_train, prepared.y_train)
    result["dataset_name"] = dataset
    result["feature_names"] = prepared.feature_names
    return result


@router.get("/api/svd")
def svd(dataset: str = Query("balanced")):
    try:
        prepared = STATE.get_prepared(dataset)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    result = run_svd(prepared.X_train)
    result["dataset_name"] = dataset
    return result


@router.get("/api/lda")
def lda(dataset: str = Query("balanced")):
    try:
        prepared = STATE.get_prepared(dataset)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    result = run_lda(prepared.X_train, prepared.y_train, prepared.feature_names)
    result["dataset_name"] = dataset
    return result
