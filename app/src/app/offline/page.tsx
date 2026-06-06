"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <WifiOff className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">You&apos;re Offline</h1>
        <p className="text-sm text-muted-foreground">
          It looks like you&apos;ve lost your internet connection. Some features may be unavailable until you&apos;re back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
