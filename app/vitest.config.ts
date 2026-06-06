/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "test/integration/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        // Coverage thresholds apply only to the pure-logic parts that
        // have first-party unit tests. UI components and hooks are
        // covered by E2E + Playwright a11y scans instead.
        "src/utils/**/*.{ts,tsx}",
        "src/schemas/**/*.{ts,tsx}",
        "src/services/api.ts",
        "src/server/parsers/**/*.{ts,tsx}",
        "src/server/jobs/fetchNav.ts",
        "src/lib/rate-limit.ts",
        "src/lib/env.ts",
      ],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/__tests__/**",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
