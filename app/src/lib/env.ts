/**
 * Environment variable validation.
 * Import this at the top of server-side entry points to fail fast on misconfiguration.
 */

const requiredServer = [
  "FIREBASE_PROJECT_ID",
] as const;

const optionalServer = [
  "CRON_SECRET",
] as const;

const requiredClient = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

export function validateEnv() {
  // Skip validation during build
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const missing: string[] = [];

  for (const key of requiredServer) {
    if (!process.env[key]) missing.push(key);
  }

  for (const key of requiredClient) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}\n\nAdd them to .env.local or your deployment environment.`
    );
  }

  // Warn about optional vars
  for (const key of optionalServer) {
    if (!process.env[key]) {
      console.warn(`[env] Optional var ${key} is not set. Some features may not work.`);
    }
  }
}

// Auto-validate lazily on first server request, not at build time
let validated = false;
export function ensureEnv() {
  if (validated) return;
  validated = true;
  validateEnv();
}
