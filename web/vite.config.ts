import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:9000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/auth": { target: apiTarget, changeOrigin: true }
    }
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"]
  }
});
