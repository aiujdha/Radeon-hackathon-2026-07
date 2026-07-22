from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

from app.observability.error_codes import get_error
from app.schemas.models import UploadResult
from app.services.files import UploadConflictError, UploadValidationError, save_project_upload
from app.services.projects import ProjectNotFoundError


router = APIRouter(prefix="/api/projects/{project_id}/files", tags=["files"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(
    project_id: str,
    request: Request,
    file: UploadFile = File(...),
    task_file: bool = Form(default=False),
) -> UploadResult:
    try:
        relative_path, result = save_project_upload(
            request.app.state.settings,
            project_id,
            file.filename or "",
            await file.read(),
            task_file=task_file,
        )
        return result
    except ProjectNotFoundError as error:
        err = get_error("PROJECT_NOT_FOUND")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err) from error
    except UploadConflictError as error:
        err = get_error("VALIDATION_ERROR")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err) from error
    except UploadValidationError as error:
        err = get_error(error.validation.error_code)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err) from error
