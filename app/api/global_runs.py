"""Global runs list — cross‑project run history (Stage E)."""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.schemas import RunState
from app.services.runs import list_all_runs

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=list[RunState])
def list_all(request: Request) -> list[RunState]:
    """Return all runs across all projects, newest first (global history).

    This endpoint powers the ``/runs`` frontend dashboard.
    """
    return list_all_runs(request.app.state.settings)
