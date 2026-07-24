# UI-2: task workbench and human confirmation — Technical Record

- Level: S2
- Status: implemented
- Depends-on: ui-files-progress-260724-1800

## Scope

- Add task route constants to `web/src/api/paths.ts` matching the backend
  route family `/api/projects/{project_id}/tasks…` one-to-one (list/detail,
  transition, history, confirmation-queue, confirmation, audit-log, extract,
  submit-candidates, import-preview, import-confirm).
- Add `// maps:` annotated DTOs to `web/src/api/dto.ts` for `TaskUpdate`,
  `TaskStatusTransition`, `TaskChangeRecord`, `CandidateTask`,
  `ConfirmationRecord`, `ConfirmationAction`, `TaskImportDiff`,
  `TaskImportResult`, `OperationAuditRecord`, `TaskExtractionRequest` and
  `TaskExtractionResult`, plus a display-only mirror of the lifecycle
  (`PhaseFTaskStatus` union and `TASK_ALLOWED_TRANSITIONS`).
- Add typed `ApiClient` methods for all of the above, including multipart
  import preview/confirm.
- Unwrap FastAPI `detail`-nested structured error bodies in
  `web/src/api/errors.ts` so task lifecycle/import/confirmation rejections map
  to the same `ApiError` shape as flat bodies.
- Add `web/src/components/TaskWorkbench.tsx` (tabs: tasks, confirmation
  queue, import, audit log) and mount it on the project dashboard.
- Add `scripts/validate_task_ui.py` and `tests/test_task_ui_contract.py` to
  pin the frontend lifecycle mirror to `app/schemas/task_sql.py::
  ALLOWED_TRANSITIONS` and `app/schemas/models.py::PhaseFTaskStatus`.

## Lifecycle semantics

- The UI offers only targets from the mirrored transition graph; the server
  performs the authoritative check and the UI surfaces
  `TASK_INVALID_TRANSITION` / `TASK_CANCELLED_FINAL` rejections verbatim.
- A transition requires a non-empty reason; the operator identity is taken
  from the signed-in user and sent as `changed_by`.
- Import preview is a dry run: the server persists nothing until the
  confirm request, which records `confirmed_by` and the duplicate/conflict
  handling flags.
- Confirmation decisions require a signed-in operator; the queue disables
  submission without one.

## Security

- All task requests carry the Bearer token of the signed-in user; the UI
  renders only project-scoped API data.
- Known gap (unchanged by this stage): the backend task routes validate
  project existence but do not yet enforce per-role authorization; role
  enforcement remains a backend follow-up and the UI adds no false claim of
  it.

## Rollback

Revert this feature branch. UI-1a/UI-1b remain functional without the task
workbench; no backend behavior was changed except none (frontend + guard
scripts/tests only).
