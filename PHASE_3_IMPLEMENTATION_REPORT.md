# Phase 3 Implementation Report

Phase 3 adds workspace-owned forms with a mutable draft, preview, atomic publish, immutable versions, and a public `/f/[slug]` route. The original client form at `/` is unchanged.

## Status

**Complete**, with one product limitation that is required by the phase boundary: only the legacy 86-key V1 schema can collect real answers. Custom published forms render publicly but do not persist responses yet.

## Database models

Migration: `drizzle/0001_phase3_forms.sql` (applied on the configured Neon database).

### `form`

Workspace-owned. Fields: `id`, `workspaceId`, `name`, `slug` (globally unique), `status` (`draft` | `published` | `archived`), `activePublishedVersionId`, timestamps.

### `form_draft`

One row per form (`form_id` unique). JSONB `schema`, integer `revision`, workspace-scoped.

### `form_version`

Immutable snapshots. Unique `(form_id, version_number)`. JSONB `schema`, `schemaFormatVersion`, `publishedByUserId`, `publishedAt`. No update API.

## Form lifecycle

Workspace → Form → Draft → Preview → Publish → FormVersion → `/f/[slug]`.

Archived forms leave the list and are unavailable publicly.

## Draft revision/concurrency

Each successful draft save increments `revision`. Clients send `expectedRevision`. Mismatch returns a conflict. The editor shows **Conflict** and asks the coach to reload. No merge.

## Publishing transaction

`publishForm()` runs in a `pg` transaction: validate draft schema, next version number, insert `form_version`, set `activePublishedVersionId` and `status = published`. Failure leaves draft and live version unchanged.

Form writes use `getPoolDb()` (`drizzle-orm/node-postgres`) because Neon HTTP does not support transactions.

## Version immutability

Vitest publishes Version 1, edits the draft, publishes Version 2, then re-reads Version 1 from the database. Version 1 schema is unchanged.

Three version concepts:

| Concept | Example | Where |
| --- | --- | --- |
| Product version | Version 1, Version 2 | `form_version.version_number` |
| Schema format version | `onboarding_schema_v1` | `form_version.schema_format_version` |
| Legacy Sheets schema | `onboarding_v1` | V1 fixture `schemaVersion` and Sheets metadata |

## Builder

`/forms`, `/forms/new`, `/forms/[formId]/build`.

Operations: rename form; edit title/description/intro/success; add/rename/reorder/delete sections; add/edit/duplicate/reorder/delete fields; type, required, options, validation, show-when logic; advanced answer key with confirm. Field keys do not change when the label changes. Deleting a field that other questions depend on is blocked.

Autosave is debounced (~700ms) with Saved / Saving… / Unsaved / Conflict.

## Preview

`/forms/[formId]/preview` uses `OnboardingRenderer` in `mode="preview"`. Submit does not call `/api/onboarding` and does not write Sheets. Mobile/Desktop viewport toggle. Default mobile.

## Public route

`/f/[slug]` is unauthenticated. Loads the **active published version** only, never the draft. Unpublished, archived, unknown, or invalid schemas show a generic unavailable page (no workspace IDs or internals). Branding from Coaching Profile: business name, coach name, optional hex `primaryColor`.

`/` is not redirected.

## Existing V1 seed

```bash
npm run seed:v1-form -- --email=<owner email>
```

or `--workspace=<workspace id>`.

Creates **Client Onboarding**, slug `emmanuel-onboarding` when free, draft + published Version 1, deep copy of `emmanuelOnboardingV1`. Idempotent: second run does not duplicate.

**Not run automatically** in this session. Run it against your owner account.

## Legacy V1 submission compatibility

`/` still posts to `POST /api/onboarding` with the same 86-key validator, Sheets path, health flags, and `schema_version = onboarding_v1`.

If the published schema is an exact V1 key match (`isLegacyV1Schema`), `/f/[slug]` uses the same legacy submit helper.

## Non-V1 submission limitation

Custom forms: preview, draft, publish, and public render work. Real collection is disabled until Client + Submission persistence. The builder warns the coach not to share custom forms as live intake. No throwaway response table was added.

## Workspace authorization

Private operations resolve the session workspace on the server. Browser `workspaceId` is not trusted. Tests prove workspace B cannot read/update/publish/archive workspace A forms.

## Tests

- Vitest **54 passed** (Phase 2 suite plus schema-ops and PGlite form-service tests)
- Playwright **3 passed** (`/` renderer, mocked V1 submit, unknown `/f/[slug]`)

PGlite is used for form DB tests. They do not use production Neon.

Playwright does not log in and republish against live Neon. Version immutability is covered in Vitest.

## Build verification

| Check | Result |
| --- | --- |
| TypeScript (`next build`) | Pass |
| ESLint | Pass after moving JSX out of try/catch |
| Vitest | 54 passed |
| Playwright | 3 passed |
| Production build | Pass |

## Migration applied

`0001_phase3_forms` applied successfully via `npm run db:migrate`.

## Manual steps

1. Sign in, open `/forms`, create an onboarding (blank or V1 copy).
2. Seed the live V1 public copy if you want `/f/emmanuel-onboarding`:
   `npm run seed:v1-form -- --email=<your login email>`
3. Confirm `/` still works for existing clients.

## Known limitations

- Custom published forms cannot store answers yet.
- Slug editing is not in the UI.
- Version rollback is not implemented.
- Playwright does not exercise a full publish → `/f/[slug]` → draft-edit → republish loop against Neon.
- `estimatedMinutes` is now `{ min, max }` (display still `8–12 minutes`).

## Next-phase readiness

Form, Draft, and FormVersion exist with optimistic concurrency and immutable publishes. The next phase can add Client + Submission without changing this lifecycle. Do not start that phase until asked.
