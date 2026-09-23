# PHASE_8_IMPLEMENTATION_REPORT.md

## Status

Phase 8 production hardening is implemented. Product scope is unchanged: Agent Draft, publish, canonical Submission, ReviewFlags, Coach Brief, optional destinations. Postgres remains source of truth.

## Security changes

- `INTEGRATION_ENCRYPTION_KEY` must be 32 random bytes (64 hex or 32-byte base64). No SHA-256 password derivation.
- Central `lib/config.ts` validates core env at Node startup (`instrumentation.ts`). Google/OpenAI/legacy Sheets stay optional.
- Public submit rate limit (in-memory abstraction, 20/min per IP+slug). Documented as per-instance; production should put a store/proxy in front.
- Request size and answer bounds. Honeypot + minimum completion time. Idempotency UUID per FormVersion.
- Security headers (CSP, nosniff, referrer, frame deny, permissions, HSTS in production). Authenticated responses `Cache-Control: private, no-store`.
- Better Auth: 7-day session, secure cookies in production, trusted origin includes `BETTER_AUTH_URL`.
- OAuth state cookie cleared on success, error, and unauthenticated callback.
- Structured logs with blocked secret/PII keys. User errors stay generic.
- Authorization: Workspace-scoped export/delete. Maintenance uses `CRON_SECRET`, not sessions.

## Rate limiting

`MemoryRateLimiter` in `lib/security/rate-limit.ts`. Route uses IP from `X-Forwarded-For` only when `TRUST_PROXY=true` or production. 429 with generic retry copy. Not globally consistent across serverless instances.

## Submission idempotency

`submission.submission_attempt_id` with partial unique `(form_version_id, submission_attempt_id) WHERE attempt id is not null`. Replay returns the original Submission ID without new Client, flags, or deliveries.

## SSRF hardening

Re-resolve DNS on every delivery. Reject loopback, RFC1918, link-local, CGNAT, multicast/reserved IPv4, IPv6 unique-local/link-local/multicast, metadata hosts, credentials, non-HTTPS in production. Redirects remain manual. Limitation: TLS still connects by hostname after DNS check (no IP pin); DNS rebinding between resolve and connect remains a residual risk.

## Authentication/security headers

See Status. Login and product pages are `force-dynamic` where private. Public `/f/[slug]` stays dynamic so publish is not sticky.

## Recovery worker

`recoverPendingIntegrationDeliveries` claims pending, due failed, and stale processing. `recoverStaleCoachBriefs` moves stale `processing` to `failed` (retry in UI). `POST /api/internal/maintenance` with `Authorization: Bearer $CRON_SECRET`.

## Retry strategy

Backoff 30s / 2m / 10m / 30m. Cap 5 automatic attempts. Then `failed` for manual retry (`force: true`).

## Data export

Client JSON from `/api/clients/[clientId]`. Form CSV from `/api/forms/[formId]/submissions/export`. Workspace JSON from `/api/workspace`. Sections: client-provided / system / AI. No tokens, hashes, or encryption blobs.

## Client deletion

Confirm `DELETE`. Transaction removes deliveries, briefs, flags, submissions, client. Forms/versions remain. Audit event without payload copies.

## Workspace deletion

Owner only. Revokes Google best-effort, then deletes workspace-owned rows. Auth User remains. Audit after local delete.

## Logging / observability

`lib/observability/log.ts` info/warn/error JSON. Request ids on public submit and delete.

## Accessibility

Label wrapping, progressbar text, honeypot not in tab order, visible `:focus-visible`, min 48px controls already present, Move up/down in builder, conflict copy explicit. Playwright smoke on login labels. Manual keyboard still required.

## Responsive audit

Nav wraps, public form already stacked, settings/connections cards wrap, delete dialog `items-end` on small screens.

## Pagination / query improvements

Forms index metadata only (no draft/schema JSON). Clients list limit 50, latest submission columns without answers. Form/client submission lists limited to 50.

## Production configuration

See `PRODUCTION_CHECKLIST.md`. Neon backup/snapshot, deploy app, `drizzle-kit migrate`, verify, rollback by restore snapshot (do not edit old migrations).

## Legacy V1 status

V1 client onboarding is **not** mounted at `/`. `/` is the SaaS landing page. Public client onboarding is `/f/[slug]` (published version only).

Compatibility code remains: `app/onboarding/*`, `POST /api/onboarding`, legacy Google Sheets, `health-flags.ts`, and the V1 schema. Development-only harness: `/dev/legacy-onboarding` (404 in production). Do not treat Sheets V1 as V2 architecture. Live Emmanuel clients use `/f/emmanuel-onboarding` when that Form exists.

## Tests

Vitest 121 passed (17 files). Playwright 15 passed (submit recovery, attempt id, privacy confirm, login a11y, existing loops).

## Build verification

Recorded in the completion response after `tsc`, ESLint, Vitest, Playwright, `next build`, and Neon `0006`.

## Manual verification

Walk `PRODUCTION_CHECKLIST.md` release steps. Cron is not required for local `next dev`.

## Remaining limitations

- In-memory rate limiter is per instance.
- No IP pinning after DNS for webhooks.
- No full axe suite.
- No vendor APM.
- Coach Brief cron does not auto-generate (avoids surprise OpenAI spend); it only unsticks `processing`.
- Search is ILIKE bounded to 50 rows, not a search engine.

## Production readiness

V2 is ready for a careful first production deploy after checklist env, OAuth redirect, cron, and the manual walkthrough. Not a CRM or programming platform.
