/**
 * Smoke test — ensures the Firebase emulator is reachable. Skipped if
 * the emulator host is not configured (so unit-only CI runs pass).
 */
import { describe, it, expect } from "vitest";

describe("Firebase emulator", () => {
  it(
    "is reachable via FIRESTORE_EMULATOR_HOST",
    async () => {
      const host = process.env.FIRESTORE_EMULATOR_HOST;
      if (!host) {
        console.warn("Skipping: FIRESTORE_EMULATOR_HOST is not set.");
        return;
      }
      // The emulator answers a basic GET on /
      const res = await fetch(`http://${host}/`);
      expect(res.status).toBeLessThan(500);
    },
    15_000
  );
});
