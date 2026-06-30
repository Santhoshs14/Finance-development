import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";

/** Minimal NextRequest stub exposing only `headers.get`, which is all the helper reads. */
function mockReq(authHeader: string | null): NextRequest {
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? authHeader : null,
    },
  } as unknown as NextRequest;
}

describe("verifyCronAuth", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-token";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("authorizes a correct bearer token", () => {
    expect(verifyCronAuth(mockReq("Bearer s3cret-token"))).toBeNull();
  });

  it("rejects a wrong token", () => {
    const res = verifyCronAuth(mockReq("Bearer wrong-token-x"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("rejects a missing Authorization header", () => {
    expect(verifyCronAuth(mockReq(null))?.status).toBe(401);
  });

  it("rejects a token of a different length", () => {
    expect(verifyCronAuth(mockReq("Bearer s3cret-token-extra"))?.status).toBe(401);
  });

  it("rejects when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth(mockReq("Bearer s3cret-token"))?.status).toBe(401);
  });
});
