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
    <div className="fixed inset-x-4 bottom-[calc(var(--safe-bottom)_+_var(--tabbar-h)_+_28px)] z-50 animate-slide-up md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
      <div className="glass-sheet flex items-center gap-3 rounded-3xl p-4">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install WealthFlow</p>
          <p className="text-xs text-muted-foreground">Get faster access from your home screen</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleInstall}
            className="h-8 cursor-pointer rounded-full bg-brand px-3.5 text-xs font-semibold text-white transition-colors hover:bg-brand/90"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
