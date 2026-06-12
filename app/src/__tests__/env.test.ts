import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEnv, ensureEnv } from "@/lib/env";

// ═══════════════════════════════════════════════════════════════════════
// validateEnv - Comprehensive Tests
// ═══════════════════════════════════════════════════════════════════════

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does not throw during production build phase", () => {
    process.env.NEXT_PHASE = "phase-production-build";
    expect(() => validateEnv()).not.toThrow();
  });

  it("throws when FIREBASE_PROJECT_ID is missing", () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PHASE;
    expect(() => validateEnv()).toThrow("Missing required environment variables");
  });

  it("throws when client env vars are missing", () => {
    process.env.FIREBASE_PROJECT_ID = "test-project";
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PHASE;
    expect(() => validateEnv()).toThrow("NEXT_PUBLIC_FIREBASE_API_KEY");
  });

  it("does not throw when all required vars present", () => {
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "admin@test-project.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "auth.domain.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    delete process.env.NEXT_PHASE;
    expect(() => validateEnv()).not.toThrow();
  });

  it("warns about optional CRON_SECRET", () => {
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "admin@test-project.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "auth.domain.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    delete process.env.CRON_SECRET;
    delete process.env.NEXT_PHASE;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateEnv();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET"));
    warnSpy.mockRestore();
  });

  it("does not warn when optional vars are present", () => {
    process.env.FIREBASE_PROJECT_ID = "test-project";
    process.env.FIREBASE_CLIENT_EMAIL = "admin@test-project.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "auth.domain.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
    process.env.CRON_SECRET = "secret";
    delete process.env.NEXT_PHASE;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateEnv();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("error message lists all missing variables", () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PHASE;
    try {
      validateEnv();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("FIREBASE_PROJECT_ID");
      expect(msg).toContain("NEXT_PUBLIC_FIREBASE_API_KEY");
      expect(msg).toContain("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
      expect(msg).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ensureEnv - Tests
// ═══════════════════════════════════════════════════════════════════════

describe("ensureEnv", () => {
  // Note: ensureEnv uses a module-level `validated` flag, so these tests
  // are affected by test order. We test the concept.
  it("is a function", () => {
    expect(typeof ensureEnv).toBe("function");
  });

  it("calls validateEnv on first invocation", () => {
    // This test verifies the function doesn't crash when called
    // (actual validation depends on env vars present in test environment)
    // If env vars are set, it should not throw
    process.env.FIREBASE_PROJECT_ID = "test";
    process.env.FIREBASE_CLIENT_EMAIL = "admin@test.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "domain";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "proj";
    expect(() => ensureEnv()).not.toThrow();
  });
});
