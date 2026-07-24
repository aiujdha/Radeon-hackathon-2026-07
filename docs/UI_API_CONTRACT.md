# Unified workbench API contract (UI-0)

This document records only the endpoints verified against the current backend.
It is a UI integration contract, not an authorization substitute.

## Verified endpoints

| UI use | Method and path | Request | Success response | Authentication |
| --- | --- | --- | --- | --- |
| Login | `POST /auth/login` | `{ username, password }` | `TokenResponse` | No |
| Restore session | `GET /auth/me` | Bearer token | `UserProfile` | Yes |
| Project selector | `GET /api/projects` | none | `Project[]` | **Currently no server guard** |
| Create project | `POST /api/projects` | `ProjectCreate` | `Project` | **Currently no server guard** |
| Runs | `/api/projects/{project_id}/runs` | see `app/api/runs.py` | `RunState` / `RunProgress` | **Currently no server guard** |
| Project overview | `GET /projects/{project_id}/overview` | Bearer token | `ProjectOverview` | Project role `guest+` |

## Error contract

The Web client maps `401`, `403`, `404`, `409`, `422`, `429`, and `5xx` to
Chinese user-facing messages. It preserves an API `detail.message` and
`detail.error_code` when present, but never logs an access token.

## Required backend follow-up

`/api/projects`, files, and runs must receive project-aware service-side
authorization before their complete UI pages are released. Hiding controls in
the browser is not sufficient. UI-1 may consume only authorized project data;
if these guards are not available, the relevant page remains a documented API
gap rather than a client-side workaround.

## Local development

Vite proxies `/auth` and `/api` to `http://127.0.0.1:9000`. Production should
serve the compiled assets and API from the same trusted origin. Never use a
`VITE_*` environment variable for a secret.
