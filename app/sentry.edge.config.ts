import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.1,
  });
}
