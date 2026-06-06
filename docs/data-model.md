# Data model

All user-owned data lives under `users/{uid}/*` so Firestore rules can pin every read/write to `request.auth.uid == uid`.

## Collections

### `users/{uid}` (root document)

Mirror of `users/{uid}/profile/settings` for real-time `onSnapshot` reads in the client.

| Field                | Type           | Notes                                          |
| -------------------- | -------------- | ---------------------------------------------- |
| `cycleStartDay`      | int (1–28)     | Default 25                                     |
| `monthlySalary`      | number         | Used for cashflow projection                   |
| `onboardingComplete` | boolean        | Gates `/onboarding` redirect                   |
| `displayName`        | string         | Optional                                       |
| `currency`           | enum           | INR, USD, EUR, GBP, AED                        |
| `notificationPrefs`  | map            | Per-category push preferences                  |
| `updatedAt`          | Timestamp      |                                                |

### `users/{uid}/transactions/{id}`

| Field                  | Type           | Notes                                       |
| ---------------------- | -------------- | ------------------------------------------- |
| `amount`               | number         | Always positive after normalization         |
| `type`                 | enum           | `income` \| `expense`                       |
| `category`             | string         | Free-form (validated against user categories)|
| `account_id`           | string         | "" if no account linked (e.g. cash)         |
| `date`                 | YYYY-MM-DD     |                                             |
| `description`          | string         | Optional                                    |
| `notes`                | string         | Optional                                    |
| `payment_type`         | enum           | Cash, UPI, Debit Card, Credit Card, …       |
| `cycleKey`             | YYYY-MM        | Derived from `date` + `cycleStartDay`       |
| `is_recurring`         | boolean        | true if created by recurring cron           |
| `recurring_frequency`  | string         |                                             |
| `linked_transfer_id`   | string         | For paired self-transfer rows               |
| `import_hash`          | string         | SHA-256 dedup key (when imported)           |
| `createdAt`            | Timestamp      |                                             |

**Indexes**: `(cycleKey ASC, date DESC)`, `(account_id ASC, date DESC)`, `(category ASC, date DESC)`, `(type ASC, date DESC)`, `(date DESC, createdAt DESC)`.

### `users/{uid}/accounts/{id}`

| Field                    | Type           | Notes                                |
| ------------------------ | -------------- | ------------------------------------ |
| `account_name`           | string         | 1–100 chars                          |
| `type`                   | enum           | `bank` \| `wallet` \| `cash` \| `credit` |
| `balance`                | number         | For non-credit accounts              |
| `credit_limit`           | number         | Credit only                          |
| `liability`              | number         | Credit only (outstanding balance)    |
| `shared_limit_with`      | string         | Credit only (group cards by issuer)  |
| `billing_cycle_start_day`| int            | Credit only                          |
| `due_days_after`         | int            | Credit only                          |

### `users/{uid}/categories/{id}`

| Field          | Type      | Notes                                |
| -------------- | --------- | ------------------------------------ |
| `name`         | string    | Unique per user                      |
| `type`         | enum      | `income` \| `expense`                |
| `icon`         | string    |                                      |
| `color`        | hex       | e.g. `#0080ff`                       |
| `tax_section`  | enum      | `80C`, `80D`, `80CCD(1B)`, …, `None` |

### `users/{uid}/aggregates/{cycleKey}`

Maintained incrementally by transaction writes; recomputed by the daily aggregate-rollup cron.

| Field               | Type                |
| ------------------- | ------------------- |
| `totalSpent`        | number              |
| `totalIncome`       | number              |
| `transactionCount`  | int                 |
| `categoryBreakdown` | map<string, number> |
| `cycleKey`          | string              |
| `updatedAt`         | Timestamp           |

### `users/{uid}/budgetSnapshots/{cycleKey}/categories/{id}`

| Field            | Type      |
| ---------------- | --------- |
| `category`       | string    |
| `monthly_limit`  | number    |
| `createdAt`      | Timestamp |

### `users/{uid}/goals/{id}`

| Field             | Type           |
| ----------------- | -------------- |
| `goal_name`       | string         |
| `target_amount`   | number > 0     |
| `current_amount`  | number         |
| `deadline`        | YYYY-MM-DD     |
| `description`     | string         |
| `linked_funds`    | string[]       |

### `users/{uid}/investments/{id}`

| Field             | Type           |
| ----------------- | -------------- |
| `name`            | string         |
| `investment_type` | enum           |
| `buy_price`       | number > 0     |
| `current_price`   | number         |
| `quantity`        | number > 0     |
| `sip_amount`      | number         |
| `scheme_code`     | string         | AMFI scheme code (for NAV auto-update) |
| `fund_house`      | string         |
| `linked_goal_id`  | string         |
| `last_nav_update` | YYYY-MM-DD     | Set by NAV cron |

### `users/{uid}/navHistory/{schemeCode_YYYY-MM-DD}`

Daily NAV snapshots written by the NAV cron for every fund the user holds.

### `users/{uid}/lending/{id}`

| Field          | Type                                   |
| -------------- | -------------------------------------- |
| `type`         | `lent` \| `borrowed`                   |
| `person_name`  | string                                 |
| `amount`       | number > 0                             |
| `paid_amount`  | number                                 |
| `date`         | YYYY-MM-DD                             |
| `description`  | string                                 |
| `status`       | `pending` \| `partial` \| `completed`  |

### `users/{uid}/emis/{id}`

EMIs (equated monthly installments) for credit-card or personal loans.

| Field          | Type      |
| -------------- | --------- |
| `cardId`       | string?   |
| `description`  | string    |
| `totalAmount`  | number    |
| `emiAmount`    | number    |
| `tenure`       | int       |
| `monthsPaid`   | int       |
| `interestRate` | number    |
| `startDate`    | YYYY-MM-DD|

### `users/{uid}/splits/{id}`

Expense splits with friends.

| Field           | Type                                                                |
| --------------- | ------------------------------------------------------------------- |
| `description`   | string                                                              |
| `total_amount`  | number > 0                                                          |
| `date`          | YYYY-MM-DD                                                          |
| `paid_by`       | string (name)                                                       |
| `participants`  | array of `{ name, share }`                                          |
| `settled`       | boolean                                                             |
| `settlements`   | array of `{ from, to, amount, date }`                               |

### `users/{uid}/recurring/{id}`

Templates that the recurring cron expands into transactions.

| Field           | Type                                  |
| --------------- | ------------------------------------- |
| `description`   | string                                |
| `category`      | string                                |
| `amount`        | number ≠ 0                            |
| `frequency`     | `weekly` \| `monthly` \| `yearly`     |
| `next_date`     | YYYY-MM-DD                            |
| `account_id`    | string?                               |
| `payment_type`  | string?                               |
| `type`          | `income` \| `expense`                 |
| `status`        | `active` \| `paused` \| `stopped`     |
| `last_executed` | YYYY-MM-DD                            |

### `users/{uid}/notifications/{id}`

In-app notification feed. Push to phone is fanned out separately via `users/{uid}/fcmTokens/{tokenHash}`.

| Field        | Type           |
| ------------ | -------------- |
| `type`       | enum           | `bill_due`, `budget_warning`, `budget_exceeded`, `recurring_executed`, `insight`, `anomaly_detected`, `goal_milestone`, `security`, `nav_update` |
| `title`      | string         |
| `message`    | string         |
| `link`       | string         | Optional deep-link path |
| `read`       | boolean        |
| `createdAt`  | Timestamp      |

### `users/{uid}/fcmTokens/{tokenHash}`

Stored per device. Hash is SHA-256(token) truncated to 24 chars. Cleared automatically on send failure.

| Field        | Type      |
| ------------ | --------- |
| `token`      | string    |
| `label`      | string    | User-friendly device label |
| `createdAt`  | Timestamp |
| `lastSeenAt` | Timestamp |

### `users/{uid}/netWorthSnapshots/{id}`

Monthly snapshot written by the net-worth cron.

| Field         | Type                                          |
| ------------- | --------------------------------------------- |
| `date`        | YYYY-MM-DD                                    |
| `assets`      | number                                        |
| `liabilities` | number                                        |
| `netWorth`    | number                                        |
| `breakdown`   | `{ bank, investments, lending, credit, gold }` |

### `users/{uid}/passkeys/{credentialId}` — admin-only writes

WebAuthn passkeys for 2FA. Firestore rules block client writes; the `/api/auth/webauthn/*` routes use the Admin SDK exclusively.

| Field          | Type      |
| -------------- | --------- |
| `credentialId` | string (base64url) |
| `publicKey`    | string (base64url COSE) |
| `counter`      | int       |
| `deviceType`   | string?   |
| `backedUp`     | boolean?  |
| `transports`   | string[]? |
| `label`        | string?   |

### `users/{uid}/security/webauthnChallenge` — admin-only writes

Short-lived (5 min) challenge stored during a registration or authentication flow.

### `users/{uid}/audit/{id}` — admin-only writes

Append-only audit log. Client can read; only the Admin SDK can write.

| Field      | Type        |
| ---------- | ----------- |
| `event`    | string      | `auth.login`, `auth.passkey_registered`, … |
| `details`  | map         |
| `at`       | Timestamp   |

### `system/navIndex/funds/{schemeCode}` — admin-only writes

Project-wide NAV index (not per-user). Read by all authenticated users (for fund autocomplete + NAV history).

| Field        | Type      |
| ------------ | --------- |
| `schemeCode` | string    |
| `schemeName` | string    |
| `fundHouse`  | string    |
| `isin`       | string?   |
| `nav`        | number    |
| `date`       | YYYY-MM-DD|
| `updatedAt`  | Timestamp |

### `system/goldPrice/{YYYY-MM-DD}` + `system/goldPriceLatest`

Daily gold price snapshots written by the gold cron.

| Field             | Type      |
| ----------------- | --------- |
| `date`            | YYYY-MM-DD|
| `inrPerGram22K`   | number    |
| `inrPerGram24K`   | number    |
| `source`          | string    | `goodreturns.in` or `fallback` |
| `updatedAt`       | Timestamp |

## Why these shapes

- `cycleKey` is denormalized onto every transaction so we can list a cycle's transactions with a single index lookup instead of a date-range scan.
- Aggregates are precomputed (per cycle) so the dashboard's "totals" KPIs render in O(1) reads. The daily rollup cron corrects any drift.
- `passkeys` and `audit` are admin-write-only at the rules layer — this is the only way to make audit logs tamper-resistant when both the client and the Admin SDK share the same project.
- NAV + gold live in a shared `system/` collection because there's no point in duplicating the same NAV for every user.
