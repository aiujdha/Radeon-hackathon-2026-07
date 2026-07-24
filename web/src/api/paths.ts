// Centralized API endpoint paths for the Unified Web Workbench.
//
// IMPORTANT CONTRACT NOTE: the FastAPI backend uses NON-UNIFORM prefixes.
// Some domains are served under `/api` (projects, runs, tasks), while others
// are NOT (`/auth`, `/projects/...`, `/notifications`). The path constants
// below MUST match the real backend routes exactly. They are verified against
// the backend source by `scripts/validate_ui_contract.py` (UI-0 acceptance).
//
// Do not "guess" prefixes here — every value is cross-checked against
// `app/api/*.py`. Keep this file as the single source of truth for paths.

export const API_PATHS = {
  // Auth (prefix: /auth)
  login: '/auth/login',
  me: '/auth/me',

  // Projects (prefix: /api/projects)
  projects: '/api/projects',
  projectDetail: (projectId: string) => `/api/projects/${projectId}`,
  files: (projectId: string) => `/api/projects/${projectId}/files`,
  downloadFile: (projectId: string, filename: string) =>
    `/api/projects/${projectId}/files/download/${filename}`,

  // Overview (prefix: /projects/{project_id})
  overview: (projectId: string) => `/projects/${projectId}/overview`,

  // Runs (prefix: /api/projects/{project_id}/runs)
  runs: (projectId: string) => `/api/projects/${projectId}/runs`,
  runDetail: (projectId: string, runId: string) =>
    `/api/projects/${projectId}/runs/${runId}`,
  runProgress: (projectId: string, runId: string) =>
    `/api/projects/${projectId}/runs/${runId}/progress`,
  executeRun: (projectId: string, runId: string) =>
    `/api/projects/${projectId}/runs/${runId}/execute`,
  retryRun: (projectId: string, runId: string) =>
    `/api/projects/${projectId}/runs/${runId}/retry`,
  runArtifact: (projectId: string, runId: string, artifactName: string) =>
    `/api/projects/${projectId}/runs/${runId}/artifacts/${artifactName}`,

  // Tasks (absolute routes: /api/projects/{project_id}/tasks)
  // NOTE: static segments (confirmation-queue, audit-log, extract, …) are
  // declared by the backend BEFORE the dynamic `{task_id}` routes; keep the
  // same set here so the contract validator can match every path 1:1.
  tasks: (projectId: string) => `/api/projects/${projectId}/tasks`,
  taskDetail: (projectId: string, taskId: string) =>
    `/api/projects/${projectId}/tasks/${taskId}`,
  taskTransition: (projectId: string, taskId: string) =>
    `/api/projects/${projectId}/tasks/${taskId}/transition`,
  taskHistory: (projectId: string, taskId: string) =>
    `/api/projects/${projectId}/tasks/${taskId}/history`,
  taskConfirmationQueue: (projectId: string) =>
    `/api/projects/${projectId}/tasks/confirmation-queue`,
  taskConfirmation: (projectId: string, taskId: string) =>
    `/api/projects/${projectId}/tasks/confirmation/${taskId}`,
  taskAuditLog: (projectId: string) =>
    `/api/projects/${projectId}/tasks/audit-log`,
  taskExtract: (projectId: string) =>
    `/api/projects/${projectId}/tasks/extract`,
  taskSubmitCandidates: (projectId: string) =>
    `/api/projects/${projectId}/tasks/submit-candidates`,
  taskImportPreview: (projectId: string) =>
    `/api/projects/${projectId}/tasks/import-preview`,
  taskImportConfirm: (projectId: string) =>
    `/api/projects/${projectId}/tasks/import-confirm`,

  // Risks (prefix: /projects/{project_id}/risks)
  risks: (projectId: string) => `/projects/${projectId}/risks`,

  // Reports (prefix: /projects/{project_id}/reports)
  reports: (projectId: string) => `/projects/${projectId}/reports`,
  reportDetail: (projectId: string, draftId: string) =>
    `/projects/${projectId}/reports/${draftId}`,

  // Notifications (prefix: /notifications)
  notifications: '/notifications',
} as const
