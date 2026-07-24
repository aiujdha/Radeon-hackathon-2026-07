# UI-1a technical design

- Level: S2
- Status: draft

## Dependencies

- `feat/ui-foundation` for the typed API client and authenticated app shell.
- `fix/project-api-authorization` must merge before this feature is released,
  so the project list and run endpoints enforce membership server-side.

## Planned implementation

- Extend TypeScript DTOs and API client for project overview, run list, run
  detail/progress, execute, cancel, retry, and artifact URLs.
- Add project selection, dashboard cards, run history/detail panel, polling,
  and controlled artifact downloads.
- Add API-client and UI behavior tests with mocked fetch; use cloud only for
  final real-model acceptance.

## Rollback

Revert this feature branch; UI-0 remains a standalone foundation.
