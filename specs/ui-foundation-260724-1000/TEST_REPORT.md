# UI-0 test report

- Spec ID: `ui-foundation-260724-1000`
- Status: pending local Node dependency installation

## Planned verification

```bash
cd web
npm install
npm run test
npm run build
```

## Coverage

- API client attaches a Bearer token and parses successful JSON.
- API client preserves structured `401` error codes/messages.
- Network errors produce a safe user-facing message.
- TypeScript compilation and production Vite build validate the app shell.

## Cloud verification

Not required for UI-0. Real RAG/model/concurrency and AMD performance checks
remain a later cloud acceptance activity.
