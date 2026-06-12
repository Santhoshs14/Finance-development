"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken, getMessaging, onMessage, isSupported } from "firebase/messaging";
import { app } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { authFetch } from "@/services/api";
import toast from "react-hot-toast";

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

export interface FcmState {
  supported: boolean;
  permission: NotificationPermission;
  token: string | null;
  loading: boolean;
}

/**
 * Manages FCM subscription lifecycle. Permission is only requested
 * when `subscribe()` is called — never on app load. Tokens are saved
 * server-side so the API can send push to every device.
 */
export function useFcm() {
  const { user } = useAuth();
  const [state, setState] = useState<FcmState>({
    supported: false,
    permission: "default",
    token: null,
    loading: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = typeof window !== "undefined" && (await isSupported());
      if (cancelled) return;
      setState((s) => ({
        ...s,
        supported,
        permission: supported ? Notification.permission : "denied",
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Request permission + token, then upload it to the server. */
  const subscribe = useCallback(
    async (label = "Web") => {
      if (!user || !state.supported) return null;
      if (!VAPID_KEY) {
        toast.error("Push not configured (missing VAPID key)");
        return null;
      }
      setState((s) => ({ ...s, loading: true }));
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState((s) => ({ ...s, permission, loading: false }));
          return null;
        }

        const reg = await navigator.serviceWorker.register(
          `/firebase-messaging-sw.js?${new URLSearchParams({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
            messagingSenderId:
              process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
          }).toString()}`
        );
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
        if (!token) {
          throw new Error("Empty FCM token");
        }
        await authFetch("/api/notifications/fcm", {
          method: "POST",
          body: JSON.stringify({ token, label }),
        });
        setState({ supported: true, permission, token, loading: false });
        toast.success("Notifications enabled");
        return token;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to enable notifications";
        toast.error(msg);
        setState((s) => ({ ...s, loading: false }));
        return null;
      }
    },
    [user, state.supported]
  );

  /** Remove the current device's token. */
  const unsubscribe = useCallback(async () => {
    if (!state.token) return;
    try {
      await authFetch(`/api/notifications/fcm?token=${encodeURIComponent(state.token)}`, {
        method: "DELETE",
      });
      setState((s) => ({ ...s, token: null }));
      toast.success("Notifications disabled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    }
  }, [state.token]);

  /** Listen for in-foreground push events. */
  useEffect(() => {
    if (!state.supported || !user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const messaging = getMessaging(app);
      unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "WealthFlow";
        const body = payload.notification?.body ?? "";
        toast(`${title}\n${body}`, { duration: 5000 });
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [state.supported, user]);

  return { ...state, subscribe, unsubscribe };
}
