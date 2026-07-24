import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Avoid the tinypool worker teardown hang/OOM seen on Node 25 (Windows):
    // run tests in the main process instead of spawning worker threads/forks.
    isolate: false,
    fileParallelism: false,
  },
})
