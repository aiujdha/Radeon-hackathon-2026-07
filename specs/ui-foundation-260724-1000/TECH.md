# UI-0 technical design

- Level: S2
- Status: implemented

## Design

- Add an isolated Vite + React + TypeScript application under `web/`.
- Use `sessionStorage` for the browser session; tokens are not written to
  source, logs, localStorage, URLs, or Vite configuration.
- Use a single typed `ApiClient` with Authorization handling, JSON parsing, and
  status-aware user messages.
- Proxy only `/auth` and `/api` in local Vite development.
- Retain Gradio and all Python business behavior unchanged.

## Security and compatibility

- The frontend is not an authorization boundary. `docs/UI_API_CONTRACT.md`
  explicitly records that project/files/runs endpoints still need server-side
  project authorization before their full UI surfaces ship.
- No cloud, model URL, SSH credential, or external connector secret is exposed
  through `VITE_*` configuration.

## Rollback

Remove the `web/` directory and this S2 spec. No data migration or backend
runtime change is required.
