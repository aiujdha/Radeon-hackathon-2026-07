# UI-0: unified workbench foundation

## User problem

The existing Gradio MVP demonstrates one report-generation flow but cannot
comfortably host the project's later task, risk, approval, and team workflows.

## Outcome

Provide a separate Web workbench foundation with login-state recovery, a typed
API client, protected application shell, basic project landing page, friendly
error states, local proxy, and mockable tests. Keep Gradio unchanged.

## Acceptance criteria

- A user can log in through the existing `/auth/login` API and restore a valid
  session through `/auth/me` after a page refresh.
- The browser sends Bearer tokens only to the configured same-origin API client
  and does not log or place the token in source code.
- The app has guarded project and settings routes plus loading, empty, network,
  and permission-ready error states.
- It builds and tests locally without a cloud GPU.
- API authorization gaps are documented rather than bypassed by the UI.
