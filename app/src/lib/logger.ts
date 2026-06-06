/**
 * Structured logger.
 *
 * Server: emits JSON to stdout for Vercel/Cloud Run aggregation and
 *         forwards `error` + `warn` to Sentry (once wired in Phase 1).
 * Client: uses console with optional Sentry breadcrumb integration.
 *
 * Always prefer this over raw `console.*` so we get consistent
 * structure and a single seam for shipping to observability tools.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  event: string;
  uid?: string;
  [key: string]: unknown;
}

const IS_SERVER = typeof window === "undefined";
const IS_DEV = process.env.NODE_ENV !== "production";

// Sentry hook — populated by sentry.*.config.ts files in Phase 1.
// Keeping it loosely typed avoids a build-time dependency cycle.
type SentryShim = {
  captureException: (err: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
  addBreadcrumb: (b: { category?: string; message: string; level?: string; data?: Record<string, unknown> }) => void;
};

let sentry: SentryShim | null = null;

/** Called by `instrumentation.ts` once Sentry is initialized. */
export function attachSentry(s: SentryShim) {
  sentry = s;
}

function format(level: LogLevel, payload: LogPayload, err?: unknown): string {
  const base = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };
  if (err instanceof Error) {
    Object.assign(base, {
      err: { name: err.name, message: err.message, stack: err.stack },
    });
  } else if (err !== undefined) {
    Object.assign(base, { err });
  }
  return JSON.stringify(base);
}

function emit(level: LogLevel, payload: LogPayload, err?: unknown) {
  // Always serialize on the server for log aggregation.
  if (IS_SERVER) {
    const line = format(level, payload, err);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else if (IS_DEV) {
    const fn =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${level}]`, payload.event, payload, err ?? "");
  }

  // Forward to Sentry if available.
  if (sentry) {
    if (level === "error") {
      sentry.captureException(err ?? new Error(payload.event), {
        tags: { event: payload.event, ...(payload.uid ? { uid: payload.uid } : {}) },
        extra: payload,
      });
    } else if (level === "warn") {
      sentry.captureMessage(payload.event, "warning");
    } else if (level === "info") {
      sentry.addBreadcrumb({
        category: "app",
        message: payload.event,
        level: "info",
        data: payload,
      });
    }
  }
}

export const logger = {
  debug: (payload: LogPayload) => {
    if (IS_DEV) emit("debug", payload);
  },
  info: (payload: LogPayload) => emit("info", payload),
  warn: (payload: LogPayload, err?: unknown) => emit("warn", payload, err),
  error: (payload: LogPayload, err?: unknown) => emit("error", payload, err),
};
