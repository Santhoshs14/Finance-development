# Operations runbook

## Daily check (5 min)

1. **Sentry** — open project → "Issues this 24h" should be empty / triaged.
2. **Vercel Cron** — Project → Deployments → Cron runs. All jobs should show "Success" within their windows.
3. **Firestore usage** — Firebase Console → Usage. Reads and writes should track linearly with active user count.

## Cron schedule (UTC)

| Job                                | Schedule       | Path                                 | Failure mode                                       |
| ---------------------------------- | -------------- | ------------------------------------ | -------------------------------------------------- |
| Recurring transactions             | `30 0 * * *`   | `/api/cron/recurring`                | Logged + retried next day; user notified next run  |
| Aggregate rollup (prev cycle)      | `0 1 * * *`    | `/api/cron/aggregate-rollup`         | Aggregates stay slightly drifted until next run    |
| Anomaly scan (weekly)              | `0 4 * * 0`    | `/api/cron/anomaly-scan`             | No alerts for one week                             |
| AMFI NAV fetch                     | `30 16 * * *`  | `/api/cron/fetch-nav`                | Investments show stale `current_price` & `last_nav_update` |
| Gold price fetch                   | `0 17 * * *`   | `/api/cron/fetch-gold`               | Falls back to last-known cached value              |
| SIP execution (after NAV)          | `0 18 * * *`   | `/api/cron/sip`                      | Due SIPs run next day; user notified on execution  |
| Monthly net-worth snapshot         | `0 18 1 * *`   | `/api/cron/net-worth-snapshot`       | Missing one monthly data point in the chart        |

All cron handlers respond to `GET` and `POST`. `Authorization: Bearer ${CRON_SECRET}` is required.

### Manual re-run

```bash
# Re-trigger the whole job (runs prepare() + re-fans out across QStash workers):
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://yourdomain.com/api/cron/fetch-nav
```

The four user-iterating jobs (`aggregate-rollup`, `anomaly-scan`, `fetch-nav`,
`net-worth-snapshot`) dispatch a QStash message per page of users to
`/api/cron/worker/<job>`. To replay a single page manually (e.g. after fixing
one user's data), call the worker directly with the cron secret:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"ctx":{"month":"2026-06"},"uids":["<uid>"]}' \
  https://yourdomain.com/api/cron/worker/net-worth-snapshot
```

`recurring`, `fetch-gold`, and `sip` are single-invocation and have no worker route.

## Incident response

### "Cron job hasn't run / is failing"

1. Check Vercel → Functions → Logs for that route. Look for `cron.*.fatal` log lines.
2. Verify `CRON_SECRET` env var is set on Vercel.
3. Confirm the dispatcher fanned out: look for `cron.*.dispatched` with `mode: "queued"`. If it logs `mode: "inline"`, QStash is not configured — set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, and `QSTASH_TARGET_BASE_URL`. If it logs `cron.*.queue_unconfigured`, the worker URL could not be built (set `QSTASH_TARGET_BASE_URL`).
4. Check the **QStash dashboard** (Upstash console) for failed/retried messages to `/api/cron/worker/*`. QStash retries pages automatically; persistent failures show there.
5. Manually re-trigger the dispatcher (or a single worker page) with the curl commands above.
6. If a single user's iteration fails, the worker logs `cron.*.user_failed` with `uid` and continues — fix the data + re-run that page.

### "Users see stale data after a write"

Real-time updates land via Firestore `onSnapshot`. If a single user reports staleness:

1. Hard refresh (Cmd+Shift+R) — usually a stale PWA service worker. The SW is versioned per build so deploying any change refreshes it.
2. If still stale, check `DataProvider.tsx` listeners in browser devtools (Network → WS → look for `firestore.googleapis.com`).
3. Check Firestore rules for a recent change that may have rejected the read.

### "WebAuthn passkey login is broken on production"

1. Confirm `WEBAUTHN_RP_ID` is set to the exact hostname (no port, no scheme).
2. Confirm `WEBAUTHN_ORIGIN` includes `https://` and the production hostname.
3. `users/{uid}/security/webauthnChallenge` should briefly exist between `auth-options` and `auth-verify` requests — verify in Firestore.
4. Tail Sentry for `auth.webauthn.auth_verify.error` events.

### "Spike in 429 (rate limit) responses"

1. Check `app/src/lib/rate-limit.ts` — limits are 60 req/min per user for writes and 10 req/min per IP for auth endpoints.
2. If legitimate (e.g. a power user importing many transactions), bump the limit there or add an exception in `proxy.ts`.
3. If suspected abuse, the Vercel firewall can block at the edge.

## Data backup & restore

### Backup

The app provides a built-in JSON export at `/api/export` (any authenticated user can export their own data). For project-wide backup there are two options:

**Automated (recommended)** — the `/api/cron/backup` job runs daily (`0 19 * * *`) and triggers a Firestore managed export to `gs://$GCS_BACKUP_BUCKET/<YYYY-MM-DD>`. To enable it:

1. Set `GCS_BACKUP_BUCKET` to a bucket name (no `gs://` prefix).
2. Grant the Admin service account `roles/datastore.importExportAdmin` and write access to the bucket (`roles/storage.objectAdmin`).

If `GCS_BACKUP_BUCKET` is unset the job logs `cron.backup.skipped` and no-ops, so it is safe to deploy before the bucket exists.

**Manual (CLI)**:

```bash
# Firebase CLI must be authenticated
firebase firestore:export gs://your-bucket/$(date +%Y-%m-%d) --project your-project
```

### Restore

Per-user restore:

1. User downloads their own JSON via `/api/export` (Settings → Data → Download Full Backup).
2. Restore it via `POST /api/import/restore` (Settings → Data → Restore from Backup). The endpoint replays the whole export payload across all collections in chunked Admin SDK batches, keeping original document ids. It uses `merge: true`, so it is idempotent and never deletes records absent from the file.

Project-wide restore from GCS:

```bash
firebase firestore:import gs://your-bucket/2026-06-06 --project your-project
```

⚠️ This wipes the destination Firestore. Only run on a fresh project.

## Health checks for new deploys

After each production deploy:

- [ ] `https://yourdomain.com/login` loads and shows the login form
- [ ] Sign in with a test account
- [ ] Add a transaction; verify it shows on the dashboard within ~1 s
- [ ] Visit `/money/import`; verify the PDF input renders
- [ ] Visit `/calculators/income-tax`; verify the regime calculator renders
- [ ] Send a Sentry test event (`Sentry.captureMessage("Deploy smoke")` from devtools console)
- [ ] Check `Content-Security-Policy` header on `https://securityheaders.com/?q=yourdomain.com`

## Key configuration files

- [next.config.ts](../app/next.config.ts) — Security headers, PWA, Sentry wrap
- [firestore.rules](../firestore.rules) — Per-collection validation
- [firestore.indexes.json](../firestore.indexes.json) — Composite indexes
- [vercel.json](../app/vercel.json) — Cron schedules
- [proxy.ts](../app/src/proxy.ts) — Middleware (rate limit, auth gate, public paths)
