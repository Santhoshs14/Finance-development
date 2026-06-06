"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem("pwa-install-dismissed")) return;
    setDismissed(false);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setDismissed(true);
  };

  if (dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="rounded-2xl border border-border bg-background shadow-lg p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Install WealthFlow</p>
          <p className="text-xs text-muted-foreground">Get faster access from your home screen</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand/90 transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
