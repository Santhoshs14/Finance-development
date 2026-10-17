"use client";

import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { DataProvider } from "@/providers/DataProvider";
import { Toaster } from "react-hot-toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Capsule glass toasts: under the status bar on iPhone, bottom-right on laptops.
function AppToaster() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return (
    <Toaster
      position={isDesktop ? "bottom-right" : "top-center"}
      containerStyle={isDesktop ? undefined : { top: "calc(var(--safe-top) + 10px)" }}
      toastOptions={{
        duration: 3000,
        className: "text-subhead md:text-sm",
        style: {
          background: "var(--glass-tint-strong)",
          color: "hsl(var(--foreground))",
          borderRadius: 9999,
          padding: "10px 16px",
          fontWeight: 500,
          boxShadow: "var(--glass-highlight), 0 0 0 0.5px var(--glass-edge), var(--glass-shadow)",
          backdropFilter: "var(--glass-filter-strong)",
          WebkitBackdropFilter: "var(--glass-filter-strong)",
        },
        success: { iconTheme: { primary: "hsl(var(--success))", secondary: "white" } },
        error: { iconTheme: { primary: "hsl(var(--danger))", secondary: "white" } },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <DataProvider>
            {children}
          </DataProvider>
          <AppToaster />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
