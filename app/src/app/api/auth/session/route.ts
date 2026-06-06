import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { appendAudit } from "@/server/repos/profile";

/**
 * `__Host-` prefix forces:
 *   - `Secure` (HTTPS only) — even on localhost we keep this constraint
 *     in production; we relax `secure` for the dev cookie so localhost
 *     still works without HTTPS.
 *   - `Path=/`
 *   - No `Domain` attribute (so subdomains can't steal it)
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#__host_prefix
 */
const COOKIE_NAME = "__Host-session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days

export async function POST(req: NextRequest) {
  try {
    const { token } = (await req.json()) as { token?: string };

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const response = NextResponse.json({ status: "success", uid: decoded.uid });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      // The `__Host-` prefix mandates Secure. In dev we serve over http,
      // so the browser will drop the cookie. Local dev relies on the
      // existing client-side Firebase Auth state instead.
      secure: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });

    // Audit (best-effort).
    void appendAudit(decoded.uid, "auth.login", {
      ip: req.headers.get("x-forwarded-for") ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    }).catch(() => {
      /* ignore */
    });

    return response;
  } catch (err) {
    logger.warn({ event: "auth.session.failed" }, err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: "success" });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
