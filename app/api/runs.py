from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse

from app.schemas import RunState
from app.services.projects import ProjectNotFoundError
from app.services.runs import RunNotFoundError, create_run, execute_project_report_run, get_run
from app.security.paths import ensure_project_path


router = APIRouter(prefix="/api/projects/{project_id}/runs", tags=["runs"])


@router.post("", response_model=RunState, status_code=status.HTTP_201_CREATED)
def create(project_id: str, request: Request) -> RunState:
    try:
        return create_run(request.app.state.settings, project_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found") from error


@router.get("/{run_id}", response_model=RunState)
def get(project_id: str, run_id: str, request: Request) -> RunState:
    try:
        return get_run(request.app.state.settings, project_id, run_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except RunNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found") from error


@router.post("/{run_id}/execute", response_model=RunState)
def execute(project_id: str, run_id: str, request: Request) -> RunState:
    try:
        return execute_project_report_run(request.app.state.settings, project_id, run_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except RunNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found") from error


@router.get("/{run_id}/artifacts/{artifact_name}")
def download_artifact(project_id: str, run_id: str, artifact_name: str, request: Request) -> FileResponse:
    if artifact_name not in {"report", "risk_csv", "next_week_plan", "result"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact not found")
    try:
        run = get_run(request.app.state.settings, project_id, run_id)
    except (ValueError, RunNotFoundError) as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found") from error
    relative_path = run.artifacts.get(artifact_name)
    if relative_path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact not found")
    path = ensure_project_path(request.app.state.settings.output_root, project_id, *relative_path.split("/"))
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="artifact not found")
    return FileResponse(path, filename=path.name)
