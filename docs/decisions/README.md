# Architecture Decision Records

Numbered, dated records of major architectural decisions. New ADRs go in this folder.

## Index

- [001 — Use Firestore real-time listeners instead of REST polling](#001-firestore-real-time)
- [002 — Zod as single source of truth for shapes](#002-zod-schemas)
- [003 — Server repository layer (no direct adminDb access in routes)](#003-repo-layer)
- [004 — WebAuthn passkeys as second factor (no SMS OTP)](#004-passkeys)
- [005 — AMFI as canonical NAV source (no paid API)](#005-amfi)

---

## 001 Firestore real-time

**Date**: Phase 2 (foundation work).
**Status**: Accepted.

### Decision

Use Firestore `onSnapshot` listeners as the primary read path for all user data. API routes are mutation-only.

### Why

- Free real-time sync across tabs and devices comes "for free".
- Removes the polling tax (React Query refetch storm) for data that mutates frequently.
- Simplifies state management: one provider, one snapshot per collection.

### Trade-offs accepted

- Listeners consume Firestore reads per active session. Limit of 500 transactions per real-time subscription to bound cost.
- Cross-collection joins are still done in-memory in `DataProvider`.

---

## 002 Zod schemas

**Date**: Phase 0.
**Status**: Accepted.

### Decision

Every domain entity has a single Zod schema in `src/schemas/*`. API routes parse requests with it (`createHandler({ body: schema })`). Inferred TypeScript types are imported everywhere else.

### Why

- Validation and types stay in lockstep — impossible to ship a type that doesn't match runtime.
- Replaces ~30 lines of hand-rolled `if (!field) return 400` boilerplate per route.
- Error responses become predictable (`{ error, code, details? }`) so clients can render field-level errors.

### Trade-offs

- Zod adds ~12KB gzipped to the bundle. Acceptable given the validation it replaces.

---

## 003 Repo layer

**Date**: Phase 0.
**Status**: Accepted.

### Decision

API routes call functions in `src/server/repos/*`. Routes never touch `adminDb` directly.

### Why

- Centralizes Firestore access patterns (single place to add caching, sharding, or alternative backends later).
- Lets integration tests use an in-memory or emulator-backed fake without changing routes.
- Catches accidental client-side imports — `firebase-admin` is in `serverExternalPackages`, so any client import would error at build time.

### Trade-offs

- Two layers of indirection (route → repo → Firestore). Worth it for testability.

---

## 004 Passkeys

**Date**: Phase 1.
**Status**: Accepted.

### Decision

Use WebAuthn passkeys (via `@simplewebauthn/server` + `@simplewebauthn/browser`) for two-factor authentication. No SMS OTP, no authenticator-app TOTP.

### Why

- Free (no SMS cost), phishing-resistant, syncs automatically across user's iCloud/Google keychain.
- Better UX than TOTP rotation.
- India's UPI ecosystem has trained users to expect biometric prompts.

### Trade-offs

- Doesn't work on browsers without WebAuthn support (essentially none in 2026).
- Users with a single passkey on a single device risk lockout. Mitigated by keeping email/password as the recovery path — passkey is an addition, not a replacement.

---

## 005 AMFI

**Date**: Phase 6.
**Status**: Accepted.

### Decision

Pull daily NAVs from `https://www.amfiindia.com/spages/NAVAll.txt` instead of a paid API like MFAPI or RapidAPI's mutual fund endpoints.

### Why

- AMFI is the canonical regulator-mandated source. Other APIs ultimately scrape it.
- Free, no rate limits, no API key.
- ~5MB pipe-delimited file → ~30k schemes; we parse and store the latest in `system/navIndex/funds/{schemeCode}`.

### Trade-offs

- One-time daily fetch is a 5MB download. Run server-side via cron, never from the client.
- Format could change. Parser is tolerant (skips malformed lines) and covered by unit tests with fixture data.
