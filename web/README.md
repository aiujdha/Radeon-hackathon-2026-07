# ProjectPack unified workbench

UI-0 is the foundation for the complete web workbench. It intentionally keeps the
existing Gradio page untouched while providing a typed API client, authenticated
application shell, project context, route guard, local development proxy, and
contract tests.

## Local development

Start the FastAPI service first (normally on port 9000), then run:

```bash
cd web
npm install
npm run dev
```

The Vite development server proxies `/api` and `/auth` to
`http://127.0.0.1:9000` by default. Override it only for local development:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:9000 npm run dev
```

Do not put cloud credentials, model URLs, or external-system tokens in any
`VITE_*` variable: Vite exposes such values to the browser.

## Verification

```bash
npm run test
npm run build
```

The UI is testable without a GPU or cloud instance because API client tests use
mocked `fetch` responses. A real cloud environment remains necessary for RAG,
model, queue-concurrency, and AMD performance acceptance.
