import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["cookie"];
        delete event.request.headers["authorization"];
        delete event.request.headers["Authorization"];
      }
      return event;
    },
  });
}
