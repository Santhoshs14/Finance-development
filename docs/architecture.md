# Architecture

WealthFlow runs as a single Next.js 16 app (`app/`) deployed to Vercel with Firebase as the data + auth backend. Everything else (PDF parsing, NAV ingestion, push notifications, tax engines) is built into the app itself — no external microservices.

## Why this shape

- **Single deploy unit**: one `vercel.json`, one CI pipeline, one bundle to audit.
- **Real-time-first**: Firestore `onSnapshot` keeps every open tab in sync without polling.
- **Pure-function domain core**: tax, capital gains, forecasting, Monte Carlo, anomaly detection are all in `src/utils/`. ~90% unit-tested. UI is a thin shell.
- **Layered separation**: API routes never touch Firestore directly; they go through `src/server/repos/*`. Repos exist so tests can swap an in-memory fake later.

## Module boundaries

| Layer                         | What lives here                                                  | Allowed dependencies                          |
| ----------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `src/utils/`                  | Pure functions; no React; no Firebase                            | Other utils only                              |
| `src/schemas/`                | Zod schemas + inferred TypeScript types                          | `zod` + other schemas                         |
| `src/lib/`                    | Cross-cutting infra (logger, auth, rate-limit, api-handler)      | Other lib + utils + schemas                   |
| `src/server/repos/`           | Firestore data access — server-only                              | `firebase-admin`, lib, schemas                |
| `src/server/jobs/`            | External fetchers (AMFI, gold)                                   | `fetch`, lib                                  |
| `src/server/parsers/`         | Bank-statement parsers (string → ParsedTransaction[])            | None — pure                                   |
| `src/app/api/`                | Next.js route handlers                                           | `createHandler` + repos + schemas             |
| `src/components/ui/`          | Design-system primitives (Card, Button, GlowStat, …)             | React + Radix + utils                         |
| `src/components/`             | Composable feature widgets                                       | UI primitives + hooks + providers             |
| `src/hooks/`                  | React Query / Context hooks                                      | Providers + services + utils                  |
| `src/providers/`              | React Context providers (Auth, Data, Theme, QueryClient)         | Firebase client SDK + utils                   |
| `src/services/api.ts`         | Authenticated `fetch` wrapper                                    | Firebase client SDK                           |

## Data flow

### Reads (real-time)

```
Firestore  ─onSnapshot─►  DataProvider  ─Context─►  Pages / Components
```

`DataProvider.tsx` subscribes to every per-user collection on mount and exposes a single `useData()` hook. There are no separate `useTransactions`/`useAccounts` hooks — everything reads from one provider so updates are coherent.

### Writes (mutations)

```
Component  ──useMutations──►  authFetch  ──fetch──►  API route
                                                       │
                                                       ├── verifyAuth (Firebase ID token)
                                                       ├── Zod parse + validate
                                                       ├── repo call (atomic Firestore tx)
                                                       └── logger.info(event, duration_ms, status)

  ──onSnapshot──◄────  Firestore  ◄──────────────────  ┘
```

`useMutations` issues optimistic React-Query mutations; the canonical update arrives via `onSnapshot` shortly after.

### Cron (Vercel scheduled functions)

Each `app/api/cron/*` route is invoked by Vercel on a schedule defined in `vercel.json`. Cron secret in the `Authorization` header. See [README.md](../README.md#crons-vercel) for the full schedule.

## Real-time + offline

- PWA: `@ducanh2912/next-pwa` registers `/sw.js` with workbox-style runtime caching (NetworkFirst for API, CacheFirst for images/fonts/static).
- Offline fallback at `/offline`.
- FCM background pushes handled by `/firebase-messaging-sw.js` (a separate service worker that coexists with the PWA SW).

## State management

| State                    | Source of truth                | Owner               |
| ------------------------ | ------------------------------ | ------------------- |
| User collections         | Firestore                      | `DataProvider`      |
| Auth user                | Firebase Auth                  | `AuthProvider`      |
| Theme (light/dark)       | localStorage + media query     | `ThemeProvider`     |
| Goals / Investments      | Firestore (also in DataProvider) | `DataProvider` (React Query is mutation-only) |
| Net-worth snapshots      | API endpoint                   | React Query         |
| Audit log                | API endpoint                   | React Query         |
| FCM token state          | Component-local + Firestore    | `useFcm` hook       |
| Dashboard layout         | Firestore + localStorage       | `useDashboardLayout`|

## Why we don't use Server Components everywhere

`DataProvider` needs real-time Firestore subscriptions, which require the client SDK. Wrapping every page in client components keeps the data model coherent. Server components are reserved for layouts that genuinely don't need data (root layout, auth gate).

## Why no GraphQL / tRPC / RPC framework

Every endpoint is already typed end-to-end via shared Zod schemas (`src/schemas/`). Client calls `authFetch(url, …)`, server calls `createHandler({ body: schema }, …)`. There's no third format to translate to. If the API surface grows past ~30 routes we'll revisit.

## Performance budgets

Tracked via Lighthouse CI in PRs:

- Performance ≥ 0.7 (warn), Accessibility ≥ 0.9 (error)
- Initial bundle: charts are dynamic-imported so Recharts (~280KB) only loads on pages that render them
- PDF.js loaded only when the bank-import page is mounted

## Stretch — when does this design break?

- **> 1M users**: rebuild `/api/cron/*` on Cloud Tasks instead of Vercel Cron (currently single-region invocation).
- **> 10K transactions per user**: paginate `DataProvider.transactions` (currently limit 500 in real-time + cursor pagination via API).
- **Multi-tenant family budgets**: needs additive Firestore rules + an invite flow. Documented but out of scope today.
