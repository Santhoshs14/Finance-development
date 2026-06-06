/**
 * Firebase Cloud Messaging service worker — handles background pushes.
 *
 * Lives at `/firebase-messaging-sw.js`. The FCM SDK on the client
 * automatically registers this path; PWA service worker (Workbox)
 * runs on `/sw.js` so they coexist without conflict.
 */

// eslint-disable-next-line no-undef
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
// eslint-disable-next-line no-undef
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

// These are placeholders — replaced at build time via the env vars below,
// or read from URL query params during dev. Safe to ship since Firebase
// config is public.
const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER.firebaseapp.com",
  projectId: "PLACEHOLDER_PROJECT",
  messagingSenderId: "PLACEHOLDER_SENDER",
  appId: "PLACEHOLDER_APP_ID",
};

// eslint-disable-next-line no-undef
firebase.initializeApp(firebaseConfig);
// eslint-disable-next-line no-undef
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "WealthFlow";
  const options = {
    body: payload.notification?.body ?? "",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: payload.data?.tag ?? "wealthflow",
    data: payload.data ?? {},
    requireInteraction: false,
  };
  // eslint-disable-next-line no-undef, no-restricted-globals
  self.registration.showNotification(title, options);
});

// Deep-link on click
// eslint-disable-next-line no-undef, no-restricted-globals
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.link || "/";
  event.waitUntil(
    // eslint-disable-next-line no-undef
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ("focus" in win) {
          win.navigate?.(target);
          return win.focus();
        }
      }
      // eslint-disable-next-line no-undef
      return clients.openWindow(target);
    })
  );
});
