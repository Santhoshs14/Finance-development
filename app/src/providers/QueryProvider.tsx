"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Most data is real-time via DataProvider; React Query is used
            // for non-realtime endpoints (e.g. net-worth snapshots, audit log).
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // Don't retry 4xx — those are validation/auth errors.
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
