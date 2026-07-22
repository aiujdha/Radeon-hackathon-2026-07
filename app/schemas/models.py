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
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Stage E — Step timing & progress models
# ---------------------------------------------------------------------------


class StepDef(StrEnum):
    """Named phases tracked by the controlled runner."""
    PARSE = "parse"
    EMBED = "embed"
    INDEX = "index"
    RETRIEVE = "retrieve"
    RULES = "rules"
    MODEL_GENERATE = "model_generate"
    FILE_WRITE = "file_write"


class StepTiming(BaseModel):
    """Timing record for a single pipeline step."""
    step: StepDef
    started_at: datetime
    finished_at: datetime | None = None
    elapsed_ms: float | None = None
    current_file: str | None = Field(default=None, max_length=500)
    error: str | None = Field(default=None, max_length=4000)


class RunProgress(BaseModel):
    """Live progress snapshot returned via polling / SSE."""
    run_id: str
    status: RunStatus
    current_step: int = Field(default=0, ge=0, le=8)
    current_step_name: str = ""
    percentage: int = Field(default=0, ge=0, le=100)
    current_file: str | None = Field(default=None, max_length=500)
    error_summary: str | None = Field(default=None, max_length=4000)
    timing_by_step: list[StepTiming] = Field(default_factory=list)
    retry_count: int = Field(default=0, ge=0)


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
    risk_level: str = Field(default="low", pattern="^(low|medium|high)$")
    risk_reason: str = Field(default="", max_length=4000)
    recommendation: str = Field(default="", max_length=4000)


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
    # Stage E fields
    timing_by_step: list[StepTiming] = Field(default_factory=list)
    retry_count: int = Field(default=0, ge=0)
    cancel_requested: bool = Field(default=False)
    current_file: str | None = Field(default=None, max_length=500)
    total_steps: int = Field(default=8, ge=1, le=20)

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


# ---------------------------------------------------------------------------
# Stage E — File upload & validation models
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS: set[str] = {
    ".md", ".txt", ".pdf", ".docx", ".xlsx", ".csv",
}

ALLOWED_MIME_TYPES: set[str] = {
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "text/csv",
    "application/vnd.ms-excel",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

EXTENSION_TO_MIME: dict[str, list[str]] = {
    ".md": ["text/markdown", "text/x-markdown", "text/plain"],
    ".txt": ["text/plain"],
    ".pdf": ["application/pdf"],
    ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ".csv": ["text/csv", "text/plain", "application/vnd.ms-excel"],
}

MAX_UPLOAD_SIZE_MB_DEFAULT: int = 50


class FileValidationError(BaseModel):
    """Structured file validation error."""
    filename: str
    error_code: str
    message: str
    user_message: str


class UploadResult(BaseModel):
    """Result of a file upload operation."""
    relative_path: str
    size_bytes: int
    sha256: str | None = None
    mime_detected: str | None = None
    extension_matched: bool = True
    virus_scan_status: str = "skipped"


# ---------------------------------------------------------------------------
# Stage E — Error codes
# ---------------------------------------------------------------------------

class ErrorDetail(BaseModel):
    """Structured error returned by API endpoints."""
    error_code: str
    message: str
    user_message: str = ""
    details: dict[str, str] = Field(default_factory=dict)
