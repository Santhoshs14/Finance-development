/**
 * POST /api/auth/refresh
 * Refreshes the session cookie with a freshly-minted Firebase ID token.
 * The client should call this periodically (e.g. every 4 days) to keep
 * the 5-day cookie alive without forcing a re-login.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const COOKIE_NAME = "__Host-session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export async function POST(req: NextRequest) {
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const decoded = await adminAuth.verifyIdToken(token, true);
    const response = NextResponse.json({ status: "refreshed", uid: decoded.uid });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
  }
}
