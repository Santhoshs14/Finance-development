import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";

/**
 * `DEV_AUTH_BYPASS` (server-side only) lets developers run API routes
 * without going through Firebase Auth. NEVER honored in production.
 *
 * Drop-in safe even on Vercel — the env var is server-scoped (no
 * `NEXT_PUBLIC_` prefix) so it can't leak into the client bundle.
 */
const DEV_AUTH_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH_BYPASS === "true";

export interface AuthenticatedRequest extends NextRequest {
  uid: string;
}

/**
 * Verify Firebase ID token from Authorization header.
 * Returns the decoded UID or a 401 response.
 * In dev mode with DEV_AUTH_BYPASS=true, always returns a test user.
 */
export async function verifyAuth(
  req: NextRequest
): Promise<{ uid: string } | NextResponse> {
  if (DEV_AUTH_BYPASS) {
    return { uid: "dev-test-user" };
  }

  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    if (!token) throw new Error("Empty token");
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

/**
 * Helper to extract UID or return error response early in API routes.
 * Usage:
 *   const auth = await verifyAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const { uid } = auth;
 */
