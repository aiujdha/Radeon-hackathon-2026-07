from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator

from app.security.paths import validate_project_id


class ProjectStatus(StrEnum):
    CREATED = "created"
    IMPORTING = "importing"
    READY = "ready"
    FAILED = "failed"


class TaskStatus(StrEnum):
    COMPLETED = "completed"
    MOSTLY_COMPLETED = "mostly_completed"
    IN_PROGRESS = "in_progress"
    NOT_STARTED = "not_started"
    DELAYED = "delayed"
    NEEDS_CONFIRMATION = "needs_confirmation"
    CANCELLED = "cancelled"


class RunStatus(StrEnum):
    QUEUED = "queued"
    SCANNING = "scanning"
    INDEXING = "indexing"
    RETRIEVING = "retrieving"
    EVALUATING = "evaluating"
    DRAFTING = "drafting"
    WAITING_CONFIRMATION = "waiting_confirmation"
    COMPLETED = "completed"
    FAILED = "failed"


class ProjectCreate(BaseModel):
    project_id: str = Field(description="Stable lowercase project identifier")
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("project_id")
    @classmethod
    def check_project_id(cls, value: str) -> str:
        return validate_project_id(value)


class Project(ProjectCreate):
    created_at: datetime
    status: ProjectStatus = ProjectStatus.CREATED
    source_file_count: int = Field(default=0, ge=0)
    failed_file_count: int = Field(default=0, ge=0)


class Task(BaseModel):
    task_id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=500)
    owner: str | None = Field(default=None, max_length=120)
    due_date: date | None = None
    priority: str | None = Field(default=None, max_length=40)
    acceptance_criteria: str | None = Field(default=None, max_length=4000)
    source_reference: str | None = Field(default=None, max_length=1000)


class Evidence(BaseModel):
    evidence_id: str = Field(min_length=1, max_length=160)
    relative_path: str = Field(min_length=1, max_length=1000)
    locator: str = Field(min_length=1, max_length=500, description="Page, heading, sheet, or cell range")
    excerpt: str = Field(min_length=1, max_length=8000)
    score: float = Field(ge=0, le=1)


class TaskEvaluation(BaseModel):
    task_id: str = Field(min_length=1, max_length=120)
    status: TaskStatus
    explanation: str = Field(min_length=1, max_length=4000)
    evidence: list[Evidence] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)


class RunState(BaseModel):
    run_id: str = Field(min_length=1, max_length=120)
    project_id: str
    status: RunStatus = RunStatus.QUEUED
    current_step: int = Field(default=0, ge=0, le=8)
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
    error: str | None = Field(default=None, max_length=4000)
    artifacts: dict[str, str] = Field(default_factory=dict)

    @field_validator("project_id")
    @classmethod
    def check_project_id(cls, value: str) -> str:
        return validate_project_id(value)


class ReportDraft(BaseModel):
    project_id: str
    markdown: str = Field(min_length=1)
    evaluations: list[TaskEvaluation] = Field(default_factory=list)

    @field_validator("project_id")
    @classmethod
    def check_project_id(cls, value: str) -> str:
        return validate_project_id(value)
