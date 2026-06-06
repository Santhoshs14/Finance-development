"use client";

/**
 * `global-error.tsx` is rendered when something blows up in the root
 * layout. It must emit its own `<html>` + `<body>` and is the only
 * Sentry-instrumented error boundary for top-level failures.
 */
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Error from "next/error";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <Error statusCode={500} title="Something went wrong" />
      </body>
    </html>
  );
}
