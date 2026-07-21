from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.config import Settings
from app.observability.audit import validate_run_id
from app.schemas import RunState, RunStatus
from app.security.paths import ensure_project_path, validate_project_id
from app.services.projects import ProjectNotFoundError, project_paths


class RunNotFoundError(RuntimeError):
    pass


def _run_path(settings: Settings, project_id: str, run_id: str) -> Path:
    validate_project_id(project_id)
    validate_run_id(run_id)
    return ensure_project_path(settings.output_root, project_id, "runs", f"{run_id}.json")


def _write_state(path: Path, state: RunState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(state.model_dump_json(indent=2), encoding="utf-8")
    temporary.replace(path)


def create_run(settings: Settings, project_id: str) -> RunState:
    project_id = validate_project_id(project_id)
    metadata_path = project_paths(settings.project_root, settings.output_root, project_id)["project"] / "project.json"
    if not metadata_path.is_file():
        raise ProjectNotFoundError(project_id)

    now = datetime.now(UTC)
    state = RunState(
        run_id=uuid4().hex,
        project_id=project_id,
        status=RunStatus.QUEUED,
        created_at=now,
        updated_at=now,
    )
    _write_state(_run_path(settings, project_id, state.run_id), state)
    return state


def get_run(settings: Settings, project_id: str, run_id: str) -> RunState:
    path = _run_path(settings, project_id, run_id)
    if not path.is_file():
        raise RunNotFoundError(run_id)
    try:
        return RunState.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise RunNotFoundError(run_id) from error


def save_run(settings: Settings, state: RunState) -> RunState:
    updated = state.model_copy(update={"updated_at": datetime.now(UTC)})
    _write_state(_run_path(settings, updated.project_id, updated.run_id), updated)
    return updated
