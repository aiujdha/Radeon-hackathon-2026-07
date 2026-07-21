from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.observability.audit import AuditTrail
from app.schemas import RunState, RunStatus


@dataclass(frozen=True, slots=True)
class RunContext:
    run_id: str
    project_id: str


Tool = Callable[[RunContext], dict[str, Any]]


class ControlledRunner:
    """Execute a fixed, registered tool chain without model-selected actions."""

    PIPELINE: tuple[tuple[RunStatus, str], ...] = (
        (RunStatus.SCANNING, "scan"),
        (RunStatus.INDEXING, "index"),
        (RunStatus.RETRIEVING, "retrieve"),
        (RunStatus.EVALUATING, "evaluate"),
        (RunStatus.DRAFTING, "draft"),
    )

    def __init__(self, tools: dict[str, Tool], audit: AuditTrail, *, max_steps: int = 8):
        if not 1 <= max_steps <= 8:
            raise ValueError("max_steps must be between 1 and 8")
        self._tools = dict(tools)
        self._audit = audit
        self._max_steps = max_steps

    def run(self, state: RunState) -> RunState:
        if state.status is not RunStatus.QUEUED:
            raise ValueError("only queued runs can be started")

        context = RunContext(run_id=state.run_id, project_id=state.project_id)
        self._audit.write("run_started", {"project_id": state.project_id})

        for step, (status, tool_name) in enumerate(self.PIPELINE, start=1):
            if step > self._max_steps:
                return self._fail(state, step - 1, "maximum step count reached")
            tool = self._tools.get(tool_name)
            if tool is None:
                return self._fail(state, step - 1, f"required tool is not registered: {tool_name}")

            state = state.model_copy(update={"status": status, "current_step": step, "updated_at": datetime.now(UTC)})
            self._audit.write("tool_started", {"step": step, "tool": tool_name})
            try:
                result = tool(context)
            except Exception as error:  # Tool errors must become an auditable run result.
                return self._fail(state, step, f"{tool_name} failed: {error}")
            self._audit.write("tool_completed", {"step": step, "tool": tool_name, "result": result})

        completed_at = datetime.now(UTC)
        state = state.model_copy(
            update={
                "status": RunStatus.COMPLETED,
                "current_step": len(self.PIPELINE),
                "updated_at": completed_at,
                "completed_at": completed_at,
            }
        )
        self._audit.write("run_completed", {"steps": state.current_step})
        return state

    def _fail(self, state: RunState, step: int, error: str) -> RunState:
        failed_at = datetime.now(UTC)
        failed = state.model_copy(
            update={
                "status": RunStatus.FAILED,
                "current_step": step,
                "error": error,
                "updated_at": failed_at,
                "completed_at": failed_at,
            }
        )
        self._audit.write("run_failed", {"step": step, "error": error})
        return failed
