# Privacy Policy

_Last updated: 2026-06-06_

This is a placeholder template. Replace each section with your specific terms before production launch.

## 1. What we collect

WealthFlow stores the financial data **you choose to enter**:

- Bank/wallet/credit card account names and balances
- Transactions, budgets, goals, investments, EMIs, lending records
- Optional: PDF bank statements uploaded for import (processed in-memory; never stored)
- Authentication identifiers (Firebase Auth — email or Google account)
- Optional: WebAuthn passkey credentials (public key only; never the private key)
- Optional: Web Push subscription tokens (one per device that enables notifications)
- Audit log entries (login events, passkey changes, profile deletion)

## 2. What we don't collect

- We do not pull data from your bank automatically.
- We do not share or sell your data with third parties.
- We do not use third-party analytics that profile individuals beyond aggregated page-load metrics (Vercel Analytics).
- We do not have access to your bank login credentials.

## 3. Where your data is stored

All data is stored in Google Firestore in the `asia-south1` region. The hosting (Vercel) routes traffic via edge nodes globally but does not persist your data.

## 4. Third-party services

- **Firebase Auth + Firestore** (Google): identity + data store
- **Vercel** (Vercel Inc.): hosting + analytics + speed insights
- **Sentry** (optional): error monitoring (we strip cookie + authorization headers before sending)
- **AMFI India**: public NAV data (we fetch their daily file; they receive no user data)
- **GoodReturns.in**: public gold price (read-only fetch; no user data sent)

## 5. Push notifications

If you enable notifications, your browser shares an FCM token with us. We use it only to send the alerts you've opted into (bills, budgets, recurring, anomalies). You can disable in Settings → Notifications; the token is deleted immediately.

## 6. Account deletion

Settings → Profile → Delete account permanently removes:

- All your transactions, accounts, budgets, goals, investments, lending, EMIs, splits, recurring, notifications, net-worth snapshots, passkeys, FCM tokens, audit log
- Your Firebase Auth user
- Your Firestore root document

This is irreversible.

## 7. Cookies

- `__Host-session`: HttpOnly + Secure session cookie (5 days). Required for login.
- No advertising cookies. No cross-site tracking.

## 8. Children

Not intended for users under 13.

## 9. Contact

Replace this section with your contact email for privacy requests.
