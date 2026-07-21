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
from app.agent.runner import ControlledRunner
from app.observability.audit import AuditTrail
from app.services.project_workflow import build_project_report_tools


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


def execute_project_report_run(
    settings: Settings,
    project_id: str,
    run_id: str,
    *,
    index_factory=None,
    use_llm: bool = True,
    retrieval_min_score: float = 0.35,
) -> RunState:
    """Execute the approved RAG-to-report workflow for one queued project run."""
    state = get_run(settings, project_id, run_id)
    tools, artifacts = build_project_report_tools(
        settings,
        index_factory=index_factory,
        use_llm=use_llm,
        retrieval_min_score=retrieval_min_score,
    )
    runner = ControlledRunner(
        tools,
        AuditTrail(settings.log_root, state.run_id),
        max_steps=settings.agent_max_steps,
    )
    completed = runner.run(state)
    completed = completed.model_copy(update={"artifacts": artifacts.summary()})
    return save_run(settings, completed)
