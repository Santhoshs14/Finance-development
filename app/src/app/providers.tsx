"use client";

import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { DataProvider } from "@/providers/DataProvider";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <DataProvider>
            {children}
          </DataProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "var(--toast-bg, #333)",
                color: "var(--toast-color, #fff)",
              },
            }}
          />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
