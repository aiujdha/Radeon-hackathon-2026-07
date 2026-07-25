// TypeScript DTOs for the Unified Web Workbench API.
//
// CONTRACT RULE (UI-0 / spec): frontend DTO field names MUST NOT diverge from
// the backend Pydantic `app.schemas.models` fields. The backend returns
// snake_case JSON (no camelCase transform is configured), so every DTO field
// is written in snake_case to mirror the Schema 1:1. There is intentionally
// NO client-side key renaming layer.
//
// Each `export interface` carries a `// maps: <PydanticModel>` annotation.
// `scripts/validate_ui_contract.py` parses these annotations and asserts that
// every DTO field name exists on the corresponding backend model — this is
// the automated guard against hand-written, inconsistent field names.

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// maps: LoginRequest
export interface LoginRequest {
  username: string
  password: string
}

// maps: TokenResponse
export interface TokenResponse {
  access_token: string
  token_type: string
  user_id: string
  username: string
  display_name: string
}

// maps: UserProfile
export interface UserProfile {
  user_id: string
  username: string
  display_name: string
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

// maps: ProjectCreate
export interface ProjectCreate {
  project_id: string
  name: string
  description: string | null
}

// maps: Project
export interface Project {
  project_id: string
  name: string
  description: string | null
  created_at: string
  status: ProjectStatus
  source_file_count: number
  failed_file_count: number
}

export type ProjectStatus = 'created' | 'importing' | 'ready' | 'failed'

// Structural: backend returns `task_stats` as a plain dict (no named model).
export interface TaskStats {
  total: number
  [status: string]: number
}

// Structural: backend returns `risk_stats` as a plain dict (no named model).
export interface RiskStats {
  total_active?: number
  [severity: string]: number | undefined
}

// Structural: backend returns `recent_doc_changes` as list[dict] (no named model).
export interface DocChangeSummary {
  path: string
  sha256: string
  is_current: boolean
  last_seen: string
}

// Structural: backend returns `recent_runs` as list[dict] (no named model).
export interface RunSummary {
  run_id: string
  status: RunStatus
  created_at: string
  completed_at: string | null
}

// maps: ProjectOverview
export interface ProjectOverview {
  project_id: string
  project_name: string
  task_stats: TaskStats
  risk_stats: RiskStats
  pending_confirmations: number
  recent_doc_changes: DocChangeSummary[]
  recent_runs: RunSummary[]
}

// maps: UploadResult
export interface UploadResult {
  relative_path: string
  size_bytes: number
  sha256: string | null
  mime_detected: string | null
  extension_matched: boolean
  virus_scan_status: string
}

// maps: ProjectFileEntry
export interface ProjectFileEntry {
  relative_path: string
  filename: string
  size_bytes: number
  updated_at: string
  sha256: string | null
  parse_version: number | null
  index_version: number | null
  processing_status: 'uploaded' | 'indexed'
  is_task_file: boolean
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export type RunStatus =
  | 'queued'
  | 'scanning'
  | 'indexing'
  | 'retrieving'
  | 'evaluating'
  | 'drafting'
  | 'waiting_confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled'

// maps: StepTiming
export interface StepTiming {
  step: string
  started_at: string | null
  finished_at: string | null
  elapsed_ms: number | null
  current_file: string | null
  error: string | null
}

// maps: RunState
export interface RunState {
  run_id: string
  project_id: string
  status: RunStatus
  current_step: number
  created_at: string
  updated_at: string
  completed_at: string | null
  error: string | null
  artifacts: Record<string, string>
  timing_by_step: StepTiming[]
  retry_count: number
  cancel_requested: boolean
  current_file: string | null
  total_steps: number
}

// maps: RunProgress
export interface RunProgress {
  run_id: string
  status: RunStatus
  current_step: number
  current_step_name: string | null
  percentage: number
  current_file: string | null
  error_summary: string | null
  timing_by_step: StepTiming[]
  retry_count: number
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

// maps: TaskRecord
export interface TaskRecord {
  id: string
  project_id: string
  title: string
  owner: string | null
  due_date: string | null
  priority: string
  acceptance_criteria: string
  dependencies: string[]
  source_ref: string | null
  status: string
  confirmed_by: string | null
  confirmed_at: string | null
  confirmation_basis: string | null
  confirmation_notes: string | null
  created_at: string
  updated_at: string
}

// maps: TaskCreate
export interface TaskCreate {
  title: string
  owner: string | null
  due_date: string | null
  priority: string
  acceptance_criteria: string
  dependencies: string[]
  source_ref: string | null
  status: string
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export type RiskLifecycle = 'open' | 'acknowledged' | 'resolved' | 'ignored' | 'rejected'

// maps: RiskCenterEntry
export interface RiskCenterEntry {
  record_id: string
  project_id: string
  title: string
  severity: string
  lifecycle: RiskLifecycle
  description: string | null
  assigned_to: string | null
  assignee_name: string | null
  comment_count: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type ReportDraftStatus = 'draft' | 'published' | 'archived'

// maps: ReportDraftEntry
export interface ReportDraftEntry {
  id: string
  project_id: string
  title: string
  content_md: string
  version: number
  status: ReportDraftStatus
  author_id: string
  author_name: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// maps: NotificationEntry
export interface NotificationEntry {
  id: string
  kind: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  recipient_id: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Shared error body (mirrors backend `ErrorDetail`)
// ---------------------------------------------------------------------------

// maps: ErrorDetail
export interface ErrorDetail {
  error_code: string
  message: string
  user_message: string
  details: Record<string, unknown>
}
