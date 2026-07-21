from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import Project, ProjectCreate
from app.services.projects import (
    ProjectAlreadyExistsError,
    ProjectNotFoundError,
    create_project,
    get_project,
    list_projects,
)


router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[Project])
def list_all(request: Request) -> list[Project]:
    settings = request.app.state.settings
    return list_projects(settings.project_root, settings.output_root)


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
def create(payload: ProjectCreate, request: Request) -> Project:
    settings = request.app.state.settings
    try:
        return create_project(settings.project_root, settings.output_root, payload)
    except ProjectAlreadyExistsError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="project already exists") from error


@router.get("/{project_id}", response_model=Project)
def get(project_id: str, request: Request) -> Project:
    settings = request.app.state.settings
    try:
        return get_project(settings.project_root, settings.output_root, project_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found") from error
