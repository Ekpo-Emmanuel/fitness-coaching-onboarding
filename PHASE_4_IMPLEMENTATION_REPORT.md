# Phase 4 Implementation Report

Phase 4 makes Postgres the canonical store for new public `/f/[slug]` submissions. Clients are workspace-owned. Each submission is tied to the exact immutable FormVersion used at submit time. `/` remains the legacy V1 Sheets path.

## Status

**Complete** for the Phase 4 product boundary. Agent Builder, AI Coach Brief, the reusable health Rules Engine, generic Sheets destinations, and webhooks are not included.

## Database migration

Migration: `drizzle/0002_phase4_clients.sql` (applied on the configured Neon database via `npm run db:migrate`).

Additive only:

- `form_draft.client_identity_mapping` JSONB (nullable)
- `form_version.client_identity_mapping` JSONB (nullable)
- tables `client` and `submission`
- indexes listed below
- partial unique index `submission_legacy_unique` on `(workspace_id, legacy_submission_id)` where `legacy_submission_id IS NOT NULL`

Existing FormVersion **schema** snapshots were not rewritten. Identity mapping is metadata outside the immutable schema JSON. Historical Phase 3 versions stay renderable with `mapping = null`. Collection is off until a new collectible version is published. The seeded V1 form is backfilled with the known mapping when seed runs and mapping is still null.

### Foreign keys

`client` and `submission` use `ON DELETE restrict` to workspace, client, form, and form_version. Archiving a form does not delete submissions. Deleting a client later cannot silently cascade-erase onboarding history. Phase 8 can add an explicit deletion policy.

## Client model

Workspace-owned. Fields: `id`, `workspaceId`, `fullName`, `email` (original), `normalizedEmail`, `phone`, timestamps.

Email is **not** globally unique. Index: `(workspace_id, normalized_email)`. Submission ID is never used as Client ID. One client may have many submissions.

## Client identity mapping

Draft stores `clientIdentityMapping`. Publish snapshots it onto the FormVersion.

```ts
{ fullNameFieldKey, emailFieldKey, phoneFieldKey? }
```

V1 mapping: `full_name` / `email` / `phone`. The 86 answer keys are unchanged.

Blank onboardings include Full name and Email. The builder **Client identity** section picks compatible questions (text for name, email type for email, phone or short text for phone). No raw JSON required.

Publish refuses a live collectible form without a valid mapping. Public render of an old version without mapping still works; `canCollect` is false.

## Client resolution

Email normalization: trim + lowercase only. No Gmail-dot or `+alias` rewriting.

| Matches in workspace | Behavior |
| --- | --- |
| 0 | Create client |
| 1 | Reuse. Update name, submitted email, and phone only when the new value is present |
| >1 | Do not merge. Create a new client (`ambiguous_created`) |

Same email in two workspaces stays two clients.

## Submission model

Workspace + client + form + exact `formVersionId`. `answers` JSONB. Server UUID and `submittedAt`. `reviewStatus` default `new`. `source` `public_form` or `legacy_import`. Optional `legacySubmissionId` and `notes` (legacy coach notes on the submission, not a general client notes system).

## Public submission flow

`POST /api/public/forms/[slug]/submit`

Body: `{ answers }` (bare answers object also accepted). Browser does not send `workspaceId`.

Server: slug → published form → active FormVersion → parse schema → collectible mapping → `validateAnswers` on that version → extract identity → transaction (resolve/create client + insert submission).

Success: `{ ok: true, submission_id }`. Failures do not show success. No stack traces, workspace IDs, or answer dumps in logs (`public_form_submit_failed` logs slug only).

`POST /api/onboarding` is unchanged (legacy V1).

## Validation

Uses the FormVersion schema, not the current draft. Unknown keys rejected. Conditional required fields follow the existing schema engine.

## Transactions

`getPoolDb()` (`pg` Pool) wraps client resolution and submission insert. Insert failure rolls back the client created in that transaction.

## Autosave migration

`/f/[slug]` uses `onboarding_draft:<formId>:<formVersionId>`. Successful submit clears only that key. `/` still uses `emmanuel_onboarding_v1`.

## Client list/detail

- `/clients` — search name/email, empty state copy as specified, status New/Reviewed
- `/clients/[clientId]` — identity + submission history
- `/clients/[clientId]/submissions/[submissionId]` — schema-aware answers, Mark reviewed

Workspace scoped. Unknown IDs 404. `/clients` is behind the session proxy.

## Schema-aware Submission rendering

Sections and field labels from the **submission’s** FormVersion. Arrays, booleans, scales, choices, acknowledgements formatted for coaches. `unit_number` height `6 ft 2 in`; weight `185 lb`. Not the live draft.

## Form submissions page

`/forms/[formId]/submissions` lists that form’s responses with client, version, date, status. Links to submission detail.

## V1 root compatibility

`/` is not redirected. Still: renderer, autosave key, `/api/onboarding`, 86 keys, health flags, Sheets, `/coach/onboarding`.

`/f/emmanuel-onboarding` uses canonical Postgres, not Sheets, even when keys match V1.

## Historical import

```bash
npm run import:v1-submissions -- --email=<owner login email>
```

or `--workspace=<id>`. Default is dry-run. `--commit` writes. Not auto-run.

Source: `ONBOARDING_RESPONSES`, joined to `CLIENTS` by `submission_id` for `coach_notes` only. Attaches to seeded V1 Form Version 1. Idempotent on `(workspaceId, legacySubmissionId)`. Conservative client matching. Report: processed, created, reused, ambiguous, imported, skipped, errors. Does not mutate Sheets.

## Security

Private queries always include `workspaceId`. Public ownership is slug → form → workspace. Tests: workspace B cannot read workspace A clients, submissions, or form submission lists.

## Tests

- Vitest **72 passed**
- Playwright **6 passed** (V1 `/` renderer + mocked V1 submit; public unavailable; `/clients` login; mocked canonical submit success/failure/autosave when `/f/emmanuel-onboarding` exists)

New Vitest coverage: client resolution (create/reuse/ambiguous/workspace/normalization), generic submit, unknown keys, required, invalid select, conditional, archived/unpublished, missing version, malformed schema, missing/invalid mapping, publish without mapping, transaction rollback, version integrity, workspace isolation, height/weight display.

PGlite applies 0000–0002. No production Neon writes from Vitest. Playwright mocks submit APIs (no Sheets, no live insert).

## Build verification

| Check | Result |
| --- | --- |
| TypeScript (`next build`) | Pass |
| ESLint | Pass |
| Vitest | 72 passed |
| Playwright | 6 passed |
| Production build | Pass |
| `db:migrate` | `0002_phase4_clients` applied |

## Manual verification

Automated checks cover services, `/` regression, and mocked public submit. The full coach loop (create custom form → identity → publish → real Neon submit → `/clients` → edit draft → Version 2) was not walked in a logged-in browser in this session. Do that against development Neon before treating collection as live.

## Known limitations

- No AI review, Coach Brief, or automatic `needs_review`
- Generic submissions do not write Google Sheets (Phase 7)
- No client hard-delete / export policy (Phase 8)
- Historical Phase 3 custom versions without mapping cannot collect until republished with identity
- Import is manual; dry-run first
- Ambiguous duplicate emails create an extra client rather than merging
- Slug editing and version rollback still not in the UI

## Next-phase readiness

Canonical Client + Submission exist. `/f/[slug]` can collect without Sheets. Historical FormVersions remain the source of truth for answer display. Phase 5 (Agent Builder) was not started.
