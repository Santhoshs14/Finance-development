"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    // Dev-only console; in production Sentry is the source of truth.
    if (process.env.NODE_ENV !== "production") {
       
      console.error("Unhandled error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button onClick={reset} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 transition-opacity">
          Try again
        </button>
      </div>
    </div>
  );
}
