# PHASE_7_IMPLEMENTATION_REPORT.md

## Status

Phase 7 Connections is implemented. Canonical Postgres Submissions remain the source of truth. Google Sheets and Webhooks are downstream destinations. External delivery failure does not fail a committed public `/f/[slug]` submission.

## Database migration

Added `drizzle/0005_phase7_integrations.sql` and journal entry `idx: 5`. Migrations `0000`–`0004` were not modified.

- `integration` (workspace-owned, encrypted credentials column)
- `integration_delivery` with unique `(integration_id, submission_id, event_type)`
- indexes on workspace, integration, submission, and status

PGlite tests apply `0000`–`0005`. Neon development received this migration via `drizzle-kit migrate`.

## Integration model

Workspace-scoped. Types: `google_sheets`, `webhook`. Status: `connected`, `disabled`, `error`. `config` holds non-secret metadata (spreadsheet id/title, endpoint URL). `encryptedCredentials` holds the AES-GCM envelope. Disable/disconnect does not delete Clients, Submissions, ReviewFlags, or delivery history.

## IntegrationDelivery model

Durable delivery attempt. Snapshot payload is stored on the row. Status: `pending`, `processing`, `sent`, `failed`. Unique logical delivery per integration + submission + event. CoachBrief is never required.

## Credential encryption

`INTEGRATION_ENCRYPTION_KEY` is server-only. Envelope: `v1.<iv>.<tag>.<ciphertext>` using AES-256-GCM (`lib/integrations/crypto.ts`). Key material: 64-hex, 32-byte base64, or SHA-256 of another string. Version prefix allows later rotation tooling. No `NEXT_PUBLIC_INTEGRATION_ENCRYPTION_KEY`.

## Canonical delivery event

`onboarding.submitted` / `payloadVersion: "1"` (`OnboardingSubmittedEventV1`). Includes client identity from that Submission, Form id/name/versionNumber, answers, deterministic ReviewFlags, and a `fields` catalog for Sheets FIELD_MAP labels. Excludes sessions, credentials, Agent threads/ChangeSets, and CoachBrief.

## Delivery lifecycle

Inside the canonical transaction, after Client + Submission + ReviewFlags + pending CoachBrief:

1. load `status = connected` Workspace integrations
2. insert pending `IntegrationDelivery` rows with payload snapshots (`ON CONFLICT DO NOTHING`)
3. commit

After commit, `attemptDeliveries` runs synchronously with destination timeouts. Public `{ ok, submission_id }` does not depend on destination results. No unawaited serverless fire-and-forget. Network never runs inside the DB transaction.

`source = legacy_import` and the unmounted V1 `POST /api/onboarding` path do not create V2 deliveries. New connections do not backfill history.

## Retry/idempotency

`processDelivery` CAS `pending|failed` → `processing`, increments `attemptCount`, then `sent` or `failed`. `sent` is not retried. Concurrent claims see `processing`/`sent`. Sheets upsert by `submission_id`. Webhook retries reuse the stored payload; timestamp/signature may change. `POST /api/integrations/deliveries/[deliveryId]/retry` and “Retry all failed” are Workspace-scoped.

## Google OAuth architecture

Per-Workspace OAuth (`spreadsheets` scope, `access_type=offline`, consent). Start: session → Workspace → signed short-lived cookie state. Callback validates cookie HMAC against the current session Workspace/user. Query `workspaceId` is not authority. Tokens encrypted at rest. Refresh on delivery. Permanent refresh failure marks Integration `error` and coach sees Reconnect. Disconnect revokes best-effort, clears credentials, stops future deliveries, keeps history. Does not delete the spreadsheet. Independent of V1 service-account env vars.

## Google Sheets destination format

V2 tabs only: `ONBOARDING_CLIENTS`, `ONBOARDING_FIELD_MAP`, and `{FormName} [{6-char form id}]`. Does not write legacy `CLIENTS` / `ONBOARDING_RESPONSES` / `FIELD_MAP`. Form tab system columns then stable answer keys. Coach pastes URL/ID or creates “Client Onboarding Data”. No Drive Picker.

## Schema evolution in Sheets

Missing headers append. Existing columns are not reordered, deleted, or renamed. Form tab titles are not renamed when the Form name changes. FIELD_MAP is a projection, not canonical schema.

## Webhook destination

Name + HTTPS URL (HTTP allowed only outside production for localhost/dev). Server-generated signing secret shown once. HMAC-SHA256 `v1=` over `timestamp.rawBody`. Headers: `X-Onboarding-Event`, `X-Onboarding-Delivery-Id`, `X-Onboarding-Timestamp`, `X-Onboarding-Signature`. 2xx success. 4s timeout. `redirect: manual`. Disable stops new deliveries. Rotate secret replaces encrypted credential without resending history. Test event: `integration.test`.

## Webhook signing

`signWebhookBody` / `verifyWebhookSignature` with `timingSafeEqual`. Receiver should compute HMAC-SHA256(secret, timestamp + "." + rawBody) and compare in constant time.

## SSRF protection

HTTPS required in production. Reject embedded credentials, localhost (unless local allow), loopback, private IPv4/IPv6, link-local, metadata hosts, and private DNS resolution. Redirects are not followed.

## Connections UI

Protected `/settings/connections` (AppShell). Google and webhook cards, statuses (Connected / Disabled / Needs attention), recent deliveries, retry copy that the onboarding is stored, privacy notice that new submissions go to the destination. Developer HMAC notes in the webhook card. Sanitized DTOs: no tokens, blobs, or answer payloads.

## Security

Session → Workspace → Integration/Delivery on private routes. OAuth state CSRF binding. Secrets encrypted. Client payloads omit credentials and delivery snapshots. Logs use integration/delivery ids and operational codes (`integration_delivery_failed`, `webhook_timeout`, `google_sheet_access_denied`). No answer/token logging.

## Legacy V1 isolation

`POST /api/onboarding` still uses the global service account and legacy workbook. It does not create `IntegrationDelivery` rows. That renderer is no longer mounted at `/`.

## Tests

Vitest: 113 passed (16 files), including encryption, OAuth state, persist-despite-fail, two destinations, unique deliveries, HMAC independent of helper, SSRF, redirects/timeouts, disable/legacy_import skip, workspace isolation, secret rotation, Google mock tabs/headers/idempotency/revoked access.

Playwright: 13 passed. Connections sandbox is mocked (no live Google/webhook in CI). Optional: `npm run test:google-destination-live`, `npm run test:webhook-live`.

## Build verification

- TypeScript: `npx tsc --noEmit` passed
- ESLint: `npx eslint .` passed
- Vitest: 113 passed
- Playwright: 13 passed
- Production build: Next.js 16.3.5 `npx next build` passed (`/settings/connections` and integration API routes present)
- Neon: `drizzle-kit migrate` applied `0005`

## Manual verification

Still required on a real Google OAuth client and a disposable webhook endpoint. Product checklist is in the Phase 7 spec (connect, submit `/f/[slug]`, Sheets row + flags, new version column, disconnect, webhook HMAC, forced failure, retry). Legacy `/` must still write the V1 workbook only.

## Environment variables

New server-only:

- `INTEGRATION_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- optional `GOOGLE_OAUTH_REDIRECT_URI` (default `{BETTER_AUTH_URL}/api/integrations/google/callback`)

Existing V1 Sheets vars unchanged.

## Google Cloud manual setup

1. Create/select a Google Cloud project.
2. Enable Google Sheets API.
3. Configure OAuth consent (testing users if the app is in testing).
4. Create OAuth client ID (Web application).
5. Authorized redirect URI: `http://localhost:3000/api/integrations/google/callback` (and production URL when deployed).
6. Put client id/secret in `.env.local`. Generate a 32-byte key for `INTEGRATION_ENCRYPTION_KEY` (64 hex chars).
7. Restart `npm run dev`.
8. Sign in and open `/settings/connections` → Connect Google Sheets.

This setup is not assumed to already exist.

## Known limitations

- No CRM/Airtable/SQL destinations. Webhook is the interoperability layer.
- No per-Form routing; all enabled Workspace integrations receive each new public Submission.
- No historical export/backfill when a connection is added.
- No Drive file picker; paste URL/ID or create a workbook.
- SSRF is baseline (no full IP pin after connect).
- No key-rotation worker; envelope version is `v1` only.
- No durable queue; pending rows survive process death for later retry/cron.
- CoachBrief completion is not an integration event.
- Live Google/webhook smokes are opt-in and never CI.

## Phase 8 readiness

Canonical Submission + durable deliveries + two adapters are in place. Phase 8 (product hardening / export / deletion) was not started.
