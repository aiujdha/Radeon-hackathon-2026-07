from __future__ import annotations

from pathlib import Path

from app.config import Settings
from app.security.paths import ensure_project_path
from app.services.projects import ProjectNotFoundError, project_paths


class UploadValidationError(ValueError):
    pass


class UploadConflictError(RuntimeError):
    pass


_DOCUMENT_SUFFIXES = {".md", ".txt", ".pdf", ".docx", ".xlsx"}
_TASK_SUFFIXES = {".csv", ".xlsx"}


def save_project_upload(
    settings: Settings, project_id: str, filename: str, content: bytes, *, task_file: bool
) -> str:
    name = Path(filename).name
    if not name or name != filename or name in {".", ".."}:
        raise UploadValidationError("filename must not contain a path")
    suffix = Path(name).suffix.lower()
    allowed = _TASK_SUFFIXES if task_file else _DOCUMENT_SUFFIXES
    if suffix not in allowed:
        raise UploadValidationError("unsupported file type")
    if not content:
        raise UploadValidationError("uploaded file is empty")

    paths = project_paths(settings.project_root, settings.output_root, project_id)
    if not paths["project"].is_dir():
        raise ProjectNotFoundError(project_id)
    target_name = f"tasks{suffix}" if task_file else name
    target = ensure_project_path(settings.project_root, project_id, "source", target_name)
    if target.exists():
        raise UploadConflictError(f"file already exists: {target_name}")
    target.write_bytes(content)
    return f"source/{target_name}"
