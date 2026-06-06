import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/offline",
  "/privacy",
  "/terms",
]);

const AUTH_ROUTES = new Set([
  "/api/auth/session",
  "/api/auth/refresh",
  "/api/auth/webauthn/register-options",
  "/api/auth/webauthn/register-verify",
  "/api/auth/webauthn/auth-options",
  "/api/auth/webauthn/auth-verify",
]);

const SESSION_COOKIE_NAME = "__Host-session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets / PWA manifest / SW.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/swe-worker-") ||
    pathname.startsWith("/firebase-messaging-sw.js") ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // Allow public auth + marketing pages.
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // API routes — apply rate limiting for write methods + auth endpoints.
  if (pathname.startsWith("/api/")) {
    const method = req.method;
    const isWrite = method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";

    if (isWrite || AUTH_ROUTES.has(pathname)) {
      const session = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

      // Auth endpoints are tighter — IP-based at 10/min.
      const isAuthEndpoint = AUTH_ROUTES.has(pathname);
      const key = isAuthEndpoint
        ? `auth:${ip}`
        : session
        ? `user:${session.slice(-16)}`
        : `ip:${ip}`;

      const result = await rateLimit({
        key,
        limit: isAuthEndpoint ? 10 : 60,
        windowSec: 60,
      });

      if (!result.allowed) {
        const res = NextResponse.json(
          { error: "Too many requests. Please slow down.", code: "TOO_MANY_REQUESTS" },
          { status: 429 }
        );
        res.headers.set("Retry-After", String(result.retryAfter));
        return res;
      }
    }
    return NextResponse.next();
  }

  // Protected app routes — require a session cookie.
  const session = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session && pathname !== "/") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$|.*\\.svg$).*)",
  ],
};
