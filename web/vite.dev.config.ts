import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only config: proxies the backend's NON-UNIFORM prefixes to the API
// target. Kept separate from `vite.config.ts` so the test runner (Vitest)
// does not start a proxy agent. Run with: `npm run dev`.
// The FastAPI application listens on 9000 by default.  Keep the development
// proxy aligned with `.env.example` so a UI-only startup does not accidentally
// target the llama.cpp chat endpoint on 8000.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:9000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/auth': { target: API_TARGET, changeOrigin: true },
      '/projects': { target: API_TARGET, changeOrigin: true },
      '/notifications': { target: API_TARGET, changeOrigin: true },
      // UI-5 system-admin telemetry uses these non-/api route prefixes.
      '/monitor': { target: API_TARGET, changeOrigin: true },
      '/admin': { target: API_TARGET, changeOrigin: true },
    },
  },
})
