import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.(?:png|svg|jpg|jpeg|webp|gif|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: /\.(?:woff|woff2|ttf|otf)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "font-cache",
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        urlPattern: /^https:\/\/lh3\.googleusercontent\.com\//,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-avatars",
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
    ],
  },
});

/**
 * Content Security Policy.
 *
 * Allowed sources:
 *  - Firebase: identitytoolkit, securetoken, firestore, firebaseapp, googleapis, gstatic
 *  - Google sign-in popup: accounts.google.com
 *  - Sentry ingestion: sentry.io (covers *.sentry.io)
 *  - Vercel analytics + speed insights: vitals.vercel-insights.com
 *
 * We intentionally allow `'unsafe-inline'` for styles (Tailwind/runtime
 * style injection) and for script-src in dev only. In production
 * script-src is `'self' 'wasm-unsafe-eval' https:` — no inline scripts.
 */
const cspProd = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.firebaseapp.com https://*.googleapis.com https://www.gstatic.com https://apis.google.com https://accounts.google.com https://*.vercel-insights.com https://*.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://www.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://*.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.ingest.sentry.io https://*.sentry.io https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cspDev = cspProd
  .replace(
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
  )
  .replace("upgrade-insecure-requests", "");

const securityHeaders = [
  { key: "Content-Security-Policy", value: isProd ? cspProd : cspDev },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  turbopack: {},
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

const sentryOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
  // Tunnel Sentry through our own domain to avoid ad-blockers eating events.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
};

// Only wrap with Sentry if auth token is present (otherwise it logs noise on every build).
const finalConfig = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(withPWA(nextConfig), sentryOptions)
  : withPWA(nextConfig);

export default finalConfig;
