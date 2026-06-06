/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration test config — talks to a real (locally running) Firebase
 * Auth + Firestore emulator. Tests in `test/integration/` import Admin
 * SDK code and exercise repo + route handlers end-to-end.
 *
 * Run via `firebase emulators:exec --only firestore,auth "npm run test:int"`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/integration/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./test/integration/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
