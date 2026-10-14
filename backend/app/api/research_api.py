from fastapi import APIRouter

from ..services.research_content import RESEARCH_CASE_STUDY

router = APIRouter()


@router.get("/api/research")
def research():
    return RESEARCH_CASE_STUDY
