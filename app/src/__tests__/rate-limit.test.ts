import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rate-limit (in-memory)", () => {
  beforeEach(() => {
    // Each test uses a unique key so memory isolation is not needed.
  });

  it("allows first request", async () => {
    const r = await rateLimit({ key: "test-1", limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("blocks after limit exceeded", async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await rateLimit({ key: "test-2", limit: 3, windowSec: 60 });
      expect(ok.allowed).toBe(true);
    }
    const blocked = await rateLimit({ key: "test-2", limit: 3, windowSec: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("returns separate counters per key", async () => {
    await rateLimit({ key: "test-3a", limit: 2, windowSec: 60 });
    await rateLimit({ key: "test-3a", limit: 2, windowSec: 60 });
    const r1 = await rateLimit({ key: "test-3a", limit: 2, windowSec: 60 });
    expect(r1.allowed).toBe(false);
    const r2 = await rateLimit({ key: "test-3b", limit: 2, windowSec: 60 });
    expect(r2.allowed).toBe(true);
  });
});
