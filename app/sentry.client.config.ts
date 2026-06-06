import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV;

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
    ignoreErrors: [
      // Browser noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      // Firebase auth errors that are surfaced through UI already
      /Firebase: Error \(auth\//,
    ],
    beforeSend(event) {
      // Strip cookie + authorization headers from any captured fetch breadcrumbs
      if (event.request?.headers) {
        delete event.request.headers["cookie"];
        delete event.request.headers["authorization"];
        delete event.request.headers["Authorization"];
      }
      return event;
    },
  });
}
