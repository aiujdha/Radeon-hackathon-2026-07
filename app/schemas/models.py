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


# ---------------------------------------------------------------------------
# Phase F — Task lifecycle & human confirmation models
# ---------------------------------------------------------------------------

class PhaseFTaskStatus(StrEnum):
    """Task status values for the SQLite task lifecycle."""
    PENDING_CONFIRMATION = "pending_confirmation"
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    MOSTLY_COMPLETED = "mostly_completed"
    COMPLETED = "completed"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class TaskCreate(BaseModel):
    """Request model for creating a task via API."""
    title: str = Field(min_length=1, max_length=500)
    owner: str | None = Field(default=None, max_length=120)
    due_date: date | None = None
    priority: str | None = Field(default=None, max_length=40)
    acceptance_criteria: str | None = Field(default=None, max_length=4000)
    dependencies: list[str] = Field(default_factory=list, max_length=50)
    source_ref: str | None = Field(default=None, max_length=1000)
    status: PhaseFTaskStatus = PhaseFTaskStatus.PENDING_CONFIRMATION


class TaskUpdate(BaseModel):
    """Request model for updating a task via API."""
    title: str | None = Field(default=None, max_length=500)
    owner: str | None = Field(default=None, max_length=120)
    due_date: date | None = None
    priority: str | None = Field(default=None, max_length=40)
    acceptance_criteria: str | None = Field(default=None, max_length=4000)
    dependencies: list[str] | None = None
    source_ref: str | None = Field(default=None, max_length=1000)


class TaskStatusTransition(BaseModel):
    """Request model for changing a task's status."""
    status: PhaseFTaskStatus
    reason: str = Field(default="", max_length=2000)
    changed_by: str | None = Field(default=None, max_length=120)


class TaskRecord(BaseModel):
    """Full task record as stored in SQLite."""
    id: str
    project_id: str
    title: str
    owner: str | None = None
    due_date: str | None = None
    priority: str | None = None
    acceptance_criteria: str | None = None
    dependencies: list[str] = Field(default_factory=list)
    source_ref: str | None = None
    status: PhaseFTaskStatus = PhaseFTaskStatus.PENDING_CONFIRMATION
    confirmed_by: str | None = None
    confirmed_at: str | None = None
    confirmation_basis: str | None = None
    confirmation_notes: str | None = None
    created_at: str = ""
    updated_at: str = ""


class TaskChangeRecord(BaseModel):
    """Record of a single task status transition."""
    id: int
    task_id: str
    project_id: str
    from_status: str | None = None
    to_status: str
    changed_by: str | None = None
    change_reason: str | None = None
    changed_at: str = ""


class CandidateTask(BaseModel):
    """A task extracted from source material, pending human confirmation."""
    title: str = Field(min_length=1, max_length=500)
    owner: str | None = Field(default=None, max_length=120)
    due_date: date | None = None
    priority: str | None = Field(default=None, max_length=40)
    acceptance_criteria: str | None = Field(default=None, max_length=4000)
    dependencies: list[str] = Field(default_factory=list)
    source_ref: str | None = Field(default=None, max_length=1000)
    source_kind: str = Field(min_length=1, max_length=60)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class ConfirmationRecord(BaseModel):
    """A record in the human confirmation queue."""
    id: int
    task_id: str
    project_id: str
    candidate_title: str
    candidate_owner: str | None = None
    candidate_due_date: str | None = None
    candidate_priority: str | None = None
    candidate_acceptance: str | None = None
    candidate_dependencies: list[str] = Field(default_factory=list)
    source_ref: str | None = None
    source_kind: str
    confidence: float = 0.5
    status: str = "pending"
    confirmed_by: str | None = None
    confirmation_basis: str | None = None
    confirmation_notes: str | None = None
    confirmed_at: str | None = None
    created_at: str = ""


class ConfirmationAction(BaseModel):
    """Request model for a confirmation action (accept / modify / ignore)."""
    action: str = Field(pattern="^(accept|modify|ignore)$")
    confirmed_by: str = Field(min_length=1, max_length=120)
    confirmation_basis: str | None = Field(default=None, max_length=1000)
    confirmation_notes: str | None = Field(default=None, max_length=4000)
    modified_title: str | None = Field(default=None, max_length=500)
    modified_owner: str | None = Field(default=None, max_length=120)
    modified_due_date: date | None = None
    modified_priority: str | None = Field(default=None, max_length=40)
    modified_acceptance: str | None = Field(default=None, max_length=4000)
    modified_dependencies: list[str] | None = None


class TaskImportDiff(BaseModel):
    """Diff preview for CSV / XLSX import before confirmation."""
    new_rows: int = Field(default=0, ge=0)
    duplicate_rows: int = Field(default=0, ge=0)
    conflict_rows: int = Field(default=0, ge=0)
    preview: list[dict[str, str]] = Field(default_factory=list)


class TaskImportConfirm(BaseModel):
    """Request model for confirming an import."""
    confirmed_by: str = Field(min_length=1, max_length=120)
    skip_duplicates: bool = True
    overwrite_conflicts: bool = False


class TaskImportResult(BaseModel):
    """Result after confirming and executing an import."""
    imported: int = 0
    skipped: int = 0
    errors: int = 0
    details: list[str] = Field(default_factory=list)


class OperationAuditRecord(BaseModel):
    """Operation audit record."""
    id: int
    project_id: str
    entity_type: str
    entity_id: str
    operation: str
    operator: str | None = None
    details: str | None = None
    created_at: str = ""


class TaskExtractionRequest(BaseModel):
    """Request model for extracting candidate tasks from text."""
    source_text: str = Field(min_length=0, max_length=100000)
    source_kind: str = Field(default="meeting_notes", max_length=60)
    project_id: str = Field(min_length=1, max_length=120)


class TaskExtractionResult(BaseModel):
    """Result of extracting candidate tasks from a text source."""
    candidates: list[CandidateTask] = Field(default_factory=list)


class ConfirmQueueFilter(BaseModel):
    """Filter for listing confirmation queue items."""
    status: str | None = Field(default=None, pattern="^(pending|accepted|ignored)$")
