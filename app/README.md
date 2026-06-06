# WealthFlow

A modern personal-finance OS for Indian users. Tracks bank accounts, credit cards, mutual funds, gold, goals, lending, EMIs, and recurring bills with India-specific tax features (FY reports, old vs new regime, capital gains). Built as a PWA so it installs on phones and works offline.

**Live data:** AMFI NAV (daily), gold prices (daily), FCM web-push notifications.
**Security:** WebAuthn passkey 2FA, hardened session cookies, strict CSP, audit log.
**Insights:** Monte-Carlo goal forecasting, cashflow projection, what-if budgets, anomaly detection, subscription auto-discovery.

---

## Stack

- **Next.js 16.2** App Router · React 19 · TypeScript (strict)
- **Tailwind 4** · Radix primitives · Framer Motion (Glass + Glow design system)
- **Firebase** Auth + Firestore + Admin SDK · `@simplewebauthn` for passkeys
- **Recharts** (lazy-loaded) for visualizations including Sankey + Treemap + ProjectionFan
- **Sentry** for error monitoring · **Vercel Analytics + Speed Insights**
- **Vitest** unit tests · **Playwright** E2E + axe a11y · **Lighthouse CI**

---

## Repository structure

```
app/
├── src/
│   ├── app/                  # Next.js App Router pages + API routes
│   │   ├── (app)/            # Authenticated app shell
│   │   ├── (auth)/           # Login / register / forgot-password
│   │   └── api/              # Server routes (REST)
│   ├── components/           # React components
│   │   ├── ui/               # Design-system primitives
│   │   └── charts/           # Lazy-loaded Recharts widgets
│   ├── hooks/                # React hooks (useFcm, useGoals, etc.)
│   ├── lib/                  # Cross-cutting utilities
│   │   ├── api-handler.ts    # Zod + auth + error wrapper for routes
│   │   ├── auth.ts           # Firebase ID token verification
│   │   ├── logger.ts         # Structured logger w/ Sentry hook
│   │   ├── rate-limit.ts     # In-memory + Vercel KV rate limiter
│   │   └── webauthn.ts       # Passkey storage helpers
│   ├── providers/            # React Context (Auth, Data, Theme, QueryClient)
│   ├── schemas/              # Zod schemas (single source of truth for shapes)
│   ├── server/               # Server-only modules (never imported on client)
│   │   ├── repos/            # Firestore data access layer
│   │   ├── jobs/             # External fetchers (AMFI, gold)
│   │   ├── parsers/          # Bank-statement PDF parsers
│   │   └── notify.ts         # FCM push fan-out
│   ├── services/             # Client-side API wrappers
│   └── utils/                # Pure-function utilities (testable)
├── e2e/                      # Playwright specs
├── public/                   # Static assets + service workers
├── test/integration/         # Firebase-emulator integration tests
├── lighthouserc.cjs          # Lighthouse CI config
├── playwright.config.ts      # E2E config
└── vitest.config.ts          # Unit + component test config
```

---

## Getting started

### Prerequisites

- Node 20+
- Firebase project (free tier is fine)

### Environment variables

Copy `.env.example` (create one) to `.env.local`:

```bash
# ── Public (safe to expose in client bundle) ──
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
NEXT_PUBLIC_FIREBASE_APP_ID=…
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=…       # optional

# ── Server-only (NEVER commit) ──
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@…
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"

# ── Optional ──
CRON_SECRET=…                                 # required on Vercel for /api/cron/*
SENTRY_DSN=…                                  # ship errors to Sentry
SENTRY_ORG=…                                  # for source-map uploads
SENTRY_PROJECT=…
SENTRY_AUTH_TOKEN=…                           # CI/build-time only
NEXT_PUBLIC_SENTRY_DSN=…                      # client-side errors
NEXT_PUBLIC_FCM_VAPID_KEY=…                   # for web push (Firebase console → Cloud Messaging → Web Push certificates)
WEBAUTHN_RP_ID=yourdomain.com                 # WebAuthn relying-party ID
WEBAUTHN_ORIGIN=https://yourdomain.com        # comma-separated for multiple
KV_REST_API_URL=…                             # Vercel KV for distributed rate-limit (optional)
KV_REST_API_TOKEN=…

# ── Dev only ──
DEV_AUTH_BYPASS=true                          # skips Firebase auth in API routes; production-gated by NODE_ENV
```

### Install + run

```bash
cd app
npm install
npm run dev          # http://localhost:3000
```

### Tests

```bash
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
npm run test:run          # Vitest unit + component
npm run test:coverage     # with v8 coverage (≥80% on tested modules)
npm run test:int          # Integration vs Firebase emulator
npm run test:e2e          # Playwright (E2E + axe a11y)
npm run lhci:autorun      # Lighthouse CI
```

To run integration + Playwright tests locally:

```bash
firebase emulators:exec --only firestore,auth "npm run test:int"
# E2E (needs production build):
npm run build && DEV_AUTH_BYPASS=true npm run start
# in another shell:
npm run test:e2e
```

---

## Architecture

### Data flow

```
Firestore ──onSnapshot──► DataProvider ──React Context──► UI components
   ▲                                                            │
   │                                                            │
   └────── API routes ◄── authFetch (Bearer) ◄── useMutations  ┘
            (Zod validated, rate-limited, logger.info-tracked)
```

- **Reads**: Real-time `onSnapshot` listeners in `DataProvider.tsx` keep
  `accounts`, `transactions`, `categories`, `recurring`, `splits`, `goals`,
  `investments`, `lending`, `emis`, `notifications`, and `aggregates` fresh
  across tabs and devices.
- **Writes**: Always through API routes (never client-direct Firestore writes
  for mutations). Every route is auth-checked, Zod-validated, logged, and
  rate-limited.
- **Domain logic**: Pure functions in `src/utils/` — Monte Carlo, tax slabs,
  capital gains, anomaly detection, subscriptions, forecasting, financial
  cycle math. 90%+ unit-tested.

### API routes

Standardized via `createHandler()` in `src/lib/api-handler.ts`:

```typescript
export const POST = createHandler(
  { event: "transactions.create", body: createTransactionSchema },
  async ({ uid, body }) => {
    return await createTransaction(uid, body);
  }
);
```

This wrapper:
- Verifies the Firebase ID token
- Parses + validates the body with Zod
- Catches errors and returns standard `{ error, code, details? }` shapes
- Emits structured logs (`logger.info` / `logger.error`) including duration

### Crons (Vercel)

| Path                              | Schedule (UTC) | Purpose                                          |
| --------------------------------- | -------------- | ------------------------------------------------ |
| `/api/cron/recurring`             | `30 0 * * *`   | Execute due recurring transactions; bill reminders |
| `/api/cron/aggregate-rollup`      | `0 1 * * *`    | Recompute previous cycle aggregates              |
| `/api/cron/anomaly-scan`          | `0 4 * * 0`    | Weekly spend anomaly detection → notifications   |
| `/api/cron/fetch-nav`             | `30 16 * * *`  | Pull AMFI NAVAll.txt; update investments         |
| `/api/cron/fetch-gold`            | `0 17 * * *`   | Pull daily 22K + 24K gold price                  |
| `/api/cron/net-worth-snapshot`    | `0 18 1 * *`   | Monthly net-worth snapshot (1st of month)        |

Authenticated via `Authorization: Bearer ${CRON_SECRET}`.

### Security

- **Auth**: Firebase Auth (email/Google) + WebAuthn passkeys as 2FA
- **Session**: `__Host-session` cookie (httpOnly + Secure + SameSite=Lax, 5-day)
- **CSP**: Strict policy in `next.config.ts` (no inline scripts in prod)
- **Headers**: HSTS preload, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Firestore rules**: Per-collection validation; passkeys + audit + security
  subcollections are admin-SDK-only
- **Rate limit**: 60 req/min per user for writes, 10/min per IP for auth endpoints
- **Audit log**: `users/{uid}/audit` — login, passkey ops, profile deletion, etc.

### Design system (Glass + Glow)

CSS tokens in `src/app/globals.css`:

- **Elevation scale**: `--elev-0` through `--elev-5` (layered ambient + key shadows)
- **Glow tokens**: `--glow-brand`, `--glow-success`, `--glow-warning`, `--glow-danger`, `--glow-accent`, `--glow-info`
- **Gradient tokens**: `--grad-brand`, `--grad-hero`, plus semantic ones
- **Motion**: `--ease-spring` (`cubic-bezier(0.32, 0.72, 0, 1)`) + duration scale
- **Glass surfaces**: `.glass`, `.glass-strong` (`backdrop-filter` blur + saturate)

Composable primitives include `Card` (5 variants × 6 glow colors), `Button` (8 variants), `AnimatedCounter`, `GradientHero`, `GlowStat`, `TrendPill`, `CategoryDot`, `RouteTransition`.

---

## Deployment

1. **Firebase**: Create project → Authentication → enable Email/Password + Google → Cloud Firestore → start in production mode.
2. **Generate service account**: Settings → Service accounts → Generate private key. Save the three fields as env vars.
3. **Deploy rules + indexes**: `firebase deploy --only firestore:rules,firestore:indexes` (from repo root).
4. **Vercel**: Connect repo, set `app/` as root, add all env vars from above.
5. **First cron run**: After first deploy, manually `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourdomain/api/cron/fetch-nav` to populate the system NAV index.
6. **Sentry** (optional): create project → set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, and `SENTRY_AUTH_TOKEN` (for source-map uploads at build time).
7. **FCM** (optional): Firebase Console → Cloud Messaging → Web Push Certificates → generate key pair → use the public key as `NEXT_PUBLIC_FCM_VAPID_KEY`. Update `firebase-messaging-sw.js` config placeholders before deploy.

---

## Coverage targets

| Layer                              | Target | Tool                                |
| ---------------------------------- | ------ | ----------------------------------- |
| `src/utils/*`, `src/schemas/*`     | ≥ 80%  | Vitest (`npm run test:coverage`)    |
| `src/server/parsers/*`             | ≥ 80%  | Vitest                              |
| API routes                         | n/a    | Integration tests via emulator      |
| UI components & pages              | n/a    | Playwright + axe-core a11y scans    |
| End-to-end flows                   | 10     | Playwright across 4 device profiles |
| Performance (Dashboard, Login)     | ≥ 0.9  | Lighthouse CI                       |

---

## Roadmap (post-deploy)

These are intentionally deferred — the architecture supports them as drop-in additions.

- AI-powered categorization (swap `KeywordCategorizer` for a Gemini/local-LLM impl)
- Receipt OCR with Firebase Storage
- Family/shared budgets (additive Firestore rules + invite flow)
- Plaid-equivalent for Indian banks when available
- Round-up micro-savings
- Voice-add transaction (Web Speech API)

