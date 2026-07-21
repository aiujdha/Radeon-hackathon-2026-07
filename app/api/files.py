from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

from app.services.files import UploadConflictError, UploadValidationError, save_project_upload
from app.services.projects import ProjectNotFoundError


router = APIRouter(prefix="/api/projects/{project_id}/files", tags=["files"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(
    project_id: str,
    request: Request,
    file: UploadFile = File(...),
    task_file: bool = Form(default=False),
) -> dict[str, str]:
    try:
        saved = save_project_upload(
            request.app.state.settings,
            project_id,
            file.filename or "",
            await file.read(),
            task_file=task_file,
        )
        return {"relative_path": saved}
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found") from error
    except UploadConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except UploadValidationError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
