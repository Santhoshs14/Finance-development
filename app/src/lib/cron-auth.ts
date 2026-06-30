import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison. Returns false for differing lengths
 * (length is not secret here) and otherwise compares without early-exit so
 * the bearer token can't be recovered via response-timing analysis.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a cron request's `Authorization: Bearer <CRON_SECRET>` header using a
 * constant-time comparison.
 *
 * @returns a 401 `NextResponse` when unauthorized, or `null` when the request
 * is authorized (so callers can `if (res) return res;`).
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!cronSecret || !timingSafeEqualStr(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
