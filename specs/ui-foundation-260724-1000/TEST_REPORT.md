# UI-0 test report

- Spec ID: `ui-foundation-260724-1000`
- Status: verified for the UI-0 frontend scope

## Executed verification

```bash
cd web
npm install
npm run test
npm run build
```

Result on 2026-07-24:

- `npm run test`: **3 passed**.
- `npm run build`: TypeScript check and Vite production build passed.
- `python scripts/validate_specs.py --strict`: passed (`errors=0`).
- `git diff --check`: passed.

The repository-wide Python suite was started but did not finish before the
local execution tool's 64-second timeout. UI-0 does not change Python runtime
code; the required GitHub `Hygiene and specifications` workflow remains the
authoritative full-suite gate.

## Coverage

- API client attaches a Bearer token and parses successful JSON.
- API client preserves structured `401` error codes/messages.
- Network errors produce a safe user-facing message.
- TypeScript compilation and production Vite build validate the app shell.

## Cloud verification

Not required for UI-0. Real RAG/model/concurrency and AMD performance checks
remain a later cloud acceptance activity.
