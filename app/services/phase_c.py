"""Project-scoped adapters for the Phase C task and report implementation."""

from __future__ import annotations

import hashlib
from datetime import date, datetime
from pathlib import Path

from app.config import Settings
from app.reports.generator import evaluate_with_rules
from app.schemas import Evidence, ReportDraft, Task, TaskEvaluation, TaskStatus
from app.security.paths import ensure_project_path, validate_project_id
from app.tools.task_checker import _parse_date
from app.tools.task_reader import TaskRecord, read_tasks


_DEFAULT_TASK_FILES = ("tasks.xlsx", "tasks.csv", "任务表.xlsx", "任务表.csv")


def load_tasks(
    project_id: str,
    *,
    settings: Settings | None = None,
    task_relative_path: str | None = None,
) -> list[Task]:
    """Load a task list from the project's controlled ``source/`` directory.

    ``task_relative_path`` is optional only when exactly one supported default
    task filename exists at the source root. Arbitrary host paths are rejected.
    """
    runtime_settings = settings or Settings()
    project_id = validate_project_id(project_id)
    source_root = ensure_project_path(runtime_settings.project_root, project_id, "source")
    path = _resolve_task_path(source_root, runtime_settings.project_root, project_id, task_relative_path)
    records = read_tasks(path)
    return [_to_task(record, index) for index, record in enumerate(records, start=1)]


def evaluate_tasks(
    tasks: list[Task], evidence_by_task: dict[str, list[Evidence]] | None = None
) -> list[TaskEvaluation]:
    """Apply Phase C rules and return the repository's public evaluation contract."""
    evidence_by_task = evidence_by_task or {}
    evaluations: list[TaskEvaluation] = []
    for task in tasks:
        evidence = evidence_by_task.get(task.task_id, [])
        internal = evaluate_with_rules(_to_record(task), [item.excerpt for item in evidence])
        missing = internal.check_result.missing_items if internal.check_result else []
        explanation_parts = [internal.evidence_summary]
        if internal.risk_reason:
            explanation_parts.append(f"Risk: {internal.risk_reason}")
        if internal.recommendation:
            explanation_parts.append(f"Recommendation: {internal.recommendation}")
        evaluations.append(
            TaskEvaluation(
                task_id=task.task_id,
                status=TaskStatus(internal.status.value),
                explanation="\n".join(part for part in explanation_parts if part),
                evidence=evidence,
                missing_evidence=missing,
            )
        )
    return evaluations


def render_reports(project_id: str, evaluations: list[TaskEvaluation]) -> ReportDraft:
    """Create the safe, source-linked Markdown report consumed by the runner."""
    project_id = validate_project_id(project_id)
    lines = [f"# Project report: {project_id}", "", "## Task evaluations", ""]
    for evaluation in evaluations:
        lines.extend(
            [
                f"### {evaluation.task_id}",
                f"- Status: `{evaluation.status.value}`",
                f"- Explanation: {evaluation.explanation}",
            ]
        )
        if evaluation.evidence:
            lines.append("- Evidence:")
            lines.extend(
                f"  - `{item.relative_path}` ({item.locator}): {item.excerpt}" for item in evaluation.evidence
            )
        if evaluation.missing_evidence:
            lines.append(f"- Missing evidence: {', '.join(evaluation.missing_evidence)}")
        lines.append("")
    return ReportDraft(project_id=project_id, markdown="\n".join(lines).strip() + "\n", evaluations=evaluations)


def _resolve_task_path(
    source_root: Path, project_root: Path, project_id: str, task_relative_path: str | None
) -> Path:
    if task_relative_path is None:
        candidates = [source_root / name for name in _DEFAULT_TASK_FILES if (source_root / name).is_file()]
        if len(candidates) != 1:
            raise FileNotFoundError(
                "expected exactly one default task file in source/: " + ", ".join(_DEFAULT_TASK_FILES)
            )
        return candidates[0].resolve()

    candidate = ensure_project_path(project_root, project_id, "source", task_relative_path)
    try:
        candidate.relative_to(source_root.resolve())
    except ValueError as error:
        raise ValueError("task file must remain inside the project source directory") from error
    if not candidate.is_file():
        raise FileNotFoundError(f"Task file not found: {candidate}")
    return candidate


def _to_task(record: TaskRecord, index: int) -> Task:
    digest = hashlib.sha256(f"{index}:{record.title}:{record.assignee}".encode("utf-8")).hexdigest()[:16]
    parsed_deadline = _parse_date(record.deadline)
    due_date = parsed_deadline.date() if isinstance(parsed_deadline, datetime) else parsed_deadline
    return Task(
        task_id=f"task-{digest}",
        title=record.title,
        owner=record.assignee or None,
        due_date=due_date,
        priority=record.priority or None,
        acceptance_criteria=record.acceptance_criteria or None,
        source_reference=record.original_source or None,
    )


def _to_record(task: Task) -> TaskRecord:
    return TaskRecord(
        title=task.title,
        assignee=task.owner or "unassigned",
        deadline=task.due_date.isoformat() if isinstance(task.due_date, date) else "",
        priority=task.priority or "normal",
        acceptance_criteria=task.acceptance_criteria or "",
        original_source=task.source_reference or "",
    )
