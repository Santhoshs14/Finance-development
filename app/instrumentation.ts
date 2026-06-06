/**
 * Next.js `instrumentation.ts` — runs once per server runtime startup.
 * Wires Sentry config for node + edge and attaches the Sentry shim
 * to our structured logger.
 */
import * as Sentry from "@sentry/nextjs";
import { attachSentry } from "@/lib/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  // Hook Sentry into our logger so warnings/errors get auto-shipped.
  if (process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN) {
    attachSentry({
      captureException: (err, ctx) => Sentry.captureException(err, ctx),
      captureMessage: (msg, level) =>
        Sentry.captureMessage(msg, level as Sentry.SeverityLevel | undefined),
      addBreadcrumb: (b) =>
        Sentry.addBreadcrumb({
          category: b.category,
          message: b.message,
          level: b.level as Sentry.SeverityLevel | undefined,
          data: b.data,
        }),
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
