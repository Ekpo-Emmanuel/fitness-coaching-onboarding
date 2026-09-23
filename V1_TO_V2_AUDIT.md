# V1 → V2 Audit

**Status:** Phase 0 complete. No application code, packages, database, auth, AI, or Sheets behavior was changed for this audit.

**Sources of truth:** this repository as of the audit date, plus `V2_PRODUCT_SPEC.md`, `V2_ARCHITECTURE.md`, and `V2_IMPLEMENTATION_PLAN.md`.

---

## Executive Summary

V1 is a single-tenant Next.js 16 App Router app. One public multi-step onboarding form lives at `/`. Answers persist in `localStorage` until a successful POST to `/api/onboarding`. The server validates a hard-coded 86-key payload, stamps `submission_id`, UTC `submitted_at`, and `schema_version = onboarding_v1`, runs deterministic health flags, then appends rows to Google Sheets. Sheets is the canonical store. Coach review is a shared-password cookie gate over `/coach/*`.

V2 wants a schema-driven, workspace-scoped, agent-first product with an application database as canonical storage and Sheets as an optional destination. The live form UX, stable field keys, health-flag rules, and Sheets write techniques are reusable. The architecture that assumes one form, one coach, and Sheets-as-database is not.

**FIELD_MAP count:** 94 rows. Matches the reported count. `RESPONSE_COLUMNS` has 93 keys (no `coach_notes`). `CLIENT_COLUMNS` is an 18-column denormalized list that adds derived `current_weight` and `coach_notes`.

**Recommended next work:** Phase 1 (product foundation: Postgres + real auth + workspace) while leaving `/` and Sheets writes untouched. Add a test harness in the same phase because Phase 2 cannot be safe without it.

---

## Current Architecture

| Layer | What exists |
| --- | --- |
| Runtime | Next.js **16.3.5**, React **19.2.8**, TypeScript **5**, App Router |
| Package manager | **npm** (`package-lock.json`) |
| Styling | Tailwind **4** (`@tailwindcss/postcss`), Outfit + Geist fonts |
| Icons | `@phosphor-icons/react` |
| Google | `googleapis` **181** JWT service account, Sheets API v4 |
| Validation | Hand-written TypeScript in `lib/onboarding/validate.ts` (no Zod) |
| Persistence | Google Sheets only. No application database |
| Auth | Shared `COACH_DASHBOARD_PASSWORD` compared to httpOnly cookie `emmanuel_coach` |
| Routing | App Router. Route handlers under `app/api/*`. **No Server Actions** |
| Edge gate | `proxy.ts` (Next 16 middleware rename) matches `/coach/:path*` and `/api/coach/:path*` |
| Tests | **None** (no Vitest/Jest/Playwright files, no `test` script) |
| Deploy | No `vercel.json`. Assumed Node serverless (`next start` / Vercel-style). `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` |

Directory (application, omitting `.next` / `node_modules`):

```text
app/
  page.tsx                          public client form
  layout.tsx                        metadata, fonts
  globals.css
  onboarding/OnboardingFlow.tsx     all steps + autosave + submit
  onboarding/ui/fields.tsx
  coach/login/
  coach/onboarding/page.tsx         list
  coach/onboarding/[submissionId]/  detail + notes
  api/onboarding/route.ts
  api/coach/login|logout|notes/
lib/onboarding/  constants, types, validate, health-flags, field-map, service, format
lib/sheets/      client.ts, repository.ts
lib/coach/       session.ts
proxy.ts
scripts/         env, sheet access, test POST, verify row
.env.example     four server secrets, no NEXT_PUBLIC_*
```

There is no Pages Router. There is no ORM. Environment variables are server-only:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (supports `\n` escaped newlines)
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `COACH_DASHBOARD_PASSWORD`

---

## Route Map

| Route | Role |
| --- | --- |
| `GET /` | Client onboarding. Renders `OnboardingFlow`. |
| `POST /api/onboarding` | Public submit. Validate → flags → Sheets append. Returns `{ ok, submission_id }`. |
| `GET /coach/login` | Password form. Redirects to list if cookie already matches. |
| `POST /api/coach/login` | Sets cookie to **plaintext password**. |
| `POST /api/coach/logout` | Clears cookie, 303 to login. |
| `GET /coach/onboarding` | Server-rendered submission list from `CLIENTS`. |
| `GET /coach/onboarding/[submissionId]` | Full response + health banner + notes. `notFound()` if missing. |
| `POST /api/coach/notes` | Writes `coach_notes` on `CLIENTS`. Cookie required via `proxy.ts`. |

`proxy.ts` sets `?next=` on login redirects. `LoginForm` **ignores** that query and always `router.push("/coach/onboarding")`.

---

## Data Flow

1. Client edits `OnboardingDraft` in React state.
2. After hydrate, every `step`/`data` change writes `{ step, data }` JSON to `localStorage` key `emmanuel_onboarding_v1`.
3. Continue runs `validateStep(step, data)` client-side. Submit runs `validateStep(10)` then `POST /api/onboarding` with the full draft JSON.
4. Server `validateSubmission`: reject unknown keys; re-run steps 1–10; throw `ValidationError`.
5. `submitOnboarding`: `randomUUID()`, `new Date().toISOString()`, `SCHEMA_VERSION`, `onboarding_status: "submitted"`, `buildHealthFlags`, empty `coach_notes`.
6. `saveOnboarding` appends one row to `ONBOARDING_RESPONSES` and one denormalized row to `CLIENTS`. Creates tabs/headers/`FIELD_MAP` if missing.
7. Success: client clears `localStorage`, shows done state. Failure: draft stays; 400/502/503 with a retry message. Logs `onboarding_submit_failed` **without** payload.
8. Coach list/detail read Sheets. Notes PATCH-style update one `CLIENTS` cell.

If Sheets fails after validation, submission is lost on the server. Client still has autosave. There is no retry queue and no duplicate detection by email.

---

## Client Form Architecture

**Entry:** `app/page.tsx` → `OnboardingFlow`.

**Questions are hard-coded.** Labels, options, conditionals, and layout live in step components inside `OnboardingFlow.tsx`. Enumerations live in `lib/onboarding/constants.ts`. Types live in `lib/onboarding/types.ts` (`OnboardingDraft` / `ValidatedOnboarding` / `StoredOnboarding`).

**Steps (0–10):** Welcome (no validation) → About you → Health → Training → Schedule → Goals → Nutrition → Lifestyle → Progress → Coaching → Final check. Titles duplicated conceptually with `STEP_TITLES` in `validate.ts`.

**Field values:** strings for most answers; `string[]` for multi-selects; `number | null` for `sleep_quality` / `stress_level`; booleans for acknowledgements. Units are sibling keys (`height_unit`, `weight_unit`, optional `height_inches`).

**Conditionals (client):** show detail textareas when parent is `yes` (and medical `unsure`). Show macro fields when `calorie_tracking === "yes"`. Medications detail is optional even when `yes`. `gym_name` and in-person location are **always visible**, not gated on `training_location`.

**Required / validation:** `validateStep` on Continue; full `validateSubmission` on server. Step 0 has no required fields.

**Progress:** `(step / 10) * 100` after welcome; welcome shows 0. Dot rail `ProgramRail`.

**Back / Continue:** Back clears field errors and decrements step. Continue blocks on errors and scrolls to top.

**Success / failure:** inline `submitError`; success replaces the form with a done view and clears storage.

**Single-form assumptions (must break for V2):**

- Public form is `/` only.
- One `STORAGE_KEY`.
- One `SCHEMA_VERSION`.
- `validateStep` numeric steps 1–10.
- One `FIELD_MAP` / column set.
- Coach list is “all rows in this workbook”.
- Branding/copy in root `layout.tsx` metadata is Emmanuel-specific.

---

## Field Inventory

Canonical list: `lib/onboarding/field-map.ts` (`FIELD_MAP`, 94 rows). Payload allowlist: 86 client keys in `validateSubmission`. Server-added: `submission_id`, `submitted_at`, `schema_version`, `coach_review_needed`, `health_flag`, `health_flag_reasons`, `onboarding_status`. Coach-only: `coach_notes` (CLIENTS tab).

**Count check**

| Set | Count | Notes |
| --- | --- | --- |
| `FIELD_MAP` | **94** | Matches reported 94 |
| `RESPONSE_COLUMNS` | 93 | All FIELD_MAP keys except `coach_notes` |
| `CLIENT_COLUMNS` | 18 | Subset + derived `current_weight` (not a FIELD_MAP key) |
| Client allowlist | 86 | All should survive as first FormVersion keys |

**Discrepancies (not a count error):**

- `current_weight` is written to CLIENTS as `"${weight_value} ${weight_unit}"` and is **not** in FIELD_MAP.
- `gym_name` is optional in FIELD_MAP and always shown in UI; not location-conditional.
- `medication_details` optional even if medications is `yes`.
- Macro fields (`current_calories` etc.) optional strings; shown when tracking is yes; **not** numeric-validated on the server.

**V2 survival:** keep all 86 payload keys unchanged on the first published FormVersion. Map system keys to Submission metadata. Map `coach_notes` to a notes model, not a form field. Do not promote `current_weight` to a form key.

Grouped inventory (type / required / Sheets):

### system (server)

| key | type | required | Sheets | V2 |
| --- | --- | --- | --- | --- |
| submission_id | uuid | TRUE | both tabs | Submission.id |
| submitted_at | datetime | TRUE | both | Submission.createdAt |
| schema_version | string `onboarding_v1` | TRUE | responses | FormVersion metadata |
| coach_review_needed | boolean | TRUE | both | ReviewFlag |
| health_flag | string | FALSE | both | ReviewFlag label |
| health_flag_reasons | json_array | FALSE | responses | ReviewFlag codes |
| onboarding_status | string | TRUE | both | Submission.status |

### about

`full_name` string req; `email` email req; `phone` string req; `date_of_birth` date req (must be past); `sex` enum req; `height_value` number req; `height_unit` enum req; `height_inches` number conditional on `ft_in`; `weight_value` number req; `weight_unit` enum req; `occupation` string optional; `activity_level` enum req; `average_steps` enum req.

### health

Yes/no (or unsure/private) parents with conditional details: `current_injuries`, `previous_injuries`, `surgeries`, `exercise_restrictions`, `medical_conditions` (yes\|no\|unsure), `medications` (no\|yes\|prefer_privately, details optional), `pregnancy_considerations`, `health_additional_notes` optional, `health_acknowledgement` boolean req.

### training / schedule / goals / nutrition / lifestyle / progress / coaching / final

See FIELD_MAP rows in `field-map.ts` lines 172–229. Arrays: `available_days`, `equipment_access`, `secondary_goals`, `dietary_restrictions`, `progress_methods`, `feedback_preference`. Acknowledgements: `health_acknowledgement`, `accuracy_acknowledgement`.

**UI component map (not stored as types today):** `TextInput`, `TextArea`, `ChoiceList` (single), `MultiChoice`, `Scale` (1–5), `CheckRow` (ack), plus inline unit radios for height/weight.

---

## Validation Architecture

**Library:** none. Custom `ValidationError` + helpers (`required`, `inSet`, `optionalArray`, `parseNumber`, naive email regex).

**Allowlist:** extra JSON keys fail the whole form (`Unexpected fields were sent`). Missing keys fall through to per-step required checks.

**Enums:** must be in `constants.ts` sets. **Arrays:** must be arrays of known strings; several require `length > 0`. **Acknowledgements:** must be true on health step and final step. **Numbers:** height/weight ranges by unit; training days 0–7 integer; meals 1–10; scales 1–5.

**Unknown-field behavior:** hard fail, not strip.

**IDs / time / version:** generated only in `submitOnboarding` after validation. Client cannot set them.

Split for V2:

| Bucket | What |
| --- | --- |
| **A. Form-engine** | required, enum membership, array membership, min/max number, boolean ack, email/date shape, structured `show` conditionals |
| **B. Hard-coded V1** | numeric step machine 1–10; height ft/in pairing; weight range by unit; medical `unsure` requires details; medications details not required; `validateStep` duplicated on client and server |
| **C. Sheets** | stringify arrays/booleans; header ensure; `current_weight` composite; `FIELD_MAP` seed; notes column letter |

Client Continue does **not** re-validate earlier steps. A user can Back-edit a required field empty and Continue forward from a later step. Final server validation still catches it.

---

## Autosave Architecture

| Topic | Behavior |
| --- | --- |
| Mechanism | `window.localStorage` |
| Key | `emmanuel_onboarding_v1` (single global key) |
| Format | `{ step: number, data: OnboardingDraft }` JSON |
| When written | After hydrate, on every `step` or `data` change, until `done` |
| When cleared | Only after HTTP success |
| Step persisted | Yes |
| Refresh | Restores step + data (`{ ...EMPTY_DRAFT, ...saved.data }`) |
| Failed submit | Storage kept; error shown |
| Success | `removeItem` then done UI |

**Multi-form breakage:** one key overwrites across forms; no `formId`/`versionId`; no workspace scoping; draft is not server-side.

---

## Google Sheets Architecture

| Piece | Implementation |
| --- | --- |
| Auth | JWT service account, scope `spreadsheets` |
| Workbook | `GOOGLE_SHEETS_SPREADSHEET_ID` |
| Tabs | `CLIENTS`, `ONBOARDING_RESPONSES`, `FIELD_MAP` created if missing |
| Headers | Written only if row 1 empty; **not migrated** if columns later change |
| FIELD_MAP seed | Written only if tab has ≤1 row; later code changes do not update the sheet |
| Writes | `values.append` INSERT_ROWS on both data tabs |
| Reads | Full tab get; list uses `CLIENTS!A1:Z`; detail uses responses `A1:ZZ` |
| Notes | Locate `submission_id` row; `String.fromCharCode('A' + notesIndex)` — **breaks past column Z** |
| Duplicates | None. Same email → new rows. No upsert |
| Failures | Config → 503 `SheetsConfigError`. Other → 502. No partial-row compensation if CLIENTS append fails after RESPONSES append |

**Reusable later as `GoogleSheetsDestination`:** `getSheetsClient` / `getSheetsConfig`; `stringifyCell`; header ensure; append mapping; FIELD_MAP export as a destination schema dump.

**Tight coupling (cannot stay canonical):** `submitOnboarding` awaits `saveOnboarding` before returning success; coach UI reads Sheets directly; client identity **is** `submission_id` on CLIENTS (one row per submit, not a stable Client); `listClients` is workbook-global.

`CRM_destination` strings in FIELD_MAP are documentation labels (`clients.full_name`, `health.*`), not live CRM writes.

---

## Coach Review Architecture

- Login: `LoginForm` posts password. Cookie `emmanuel_coach` = **the password string**, httpOnly, SameSite=lax, Secure in production, 14-day maxAge, path `/`.
- Gate: `proxy.ts` compares cookie to `COACH_DASHBOARD_PASSWORD`. Missing env → 503 API / redirect pages.
- List: newest-first (`reverse()` after filter). Shows name, goal, date, health_flag, weight, days, status. Empty and Sheets-error states exist.
- Detail: hard-coded `Block`/`Item` sections (not schema-driven). Health banner copy: “This flag is for review only. It is not a medical assessment.”
- Notes: client component POST `/api/coach/notes`. Route trusts cookie via proxy; no CSRF token; no note length limit.

**Preserve:** mobile-first type scale, list/detail information hierarchy, health disclaimer, notes widget pattern, `format.ts` helpers, `labelOf`.

**Unsafe for multi-tenant SaaS:** one shared password; cookie is the secret; no user/workspace; any authed coach sees every row; public `/api/onboarding` unbounded; `submissionId` is the only ACL (guessable UUIDs still require cookie).

---

## Health Review Rules

**Module:** `lib/onboarding/health-flags.ts`. Called from `service.ts` **before** Sheets. Not mixed into repository mapping beyond storing the three fields.

**Not a diagnosis.** Labels are “Coach Review Needed”. Reasons are machine keys. Coach UI repeats the disclaimer.

| Trigger field | Condition | Reason key |
| --- | --- | --- |
| current_injuries | `"yes"` | `current_injury_or_pain` |
| exercise_restrictions | `"yes"` | `exercise_restriction` |
| medical_conditions | `"yes"` or `"unsure"` | `medical_condition` |
| medications | `"yes"` or `"prefer_privately"` | `medication_consideration` |
| pregnancy_considerations | `"yes"` or `"prefer_privately"` | `pregnancy_consideration` |
| health_additional_notes | non-empty trim | `other_health_note` |
| previous_injuries | `"yes"` | `previous_injury` |
| surgeries | `"yes"` | `surgery_history` |

Stored: `coach_review_needed` boolean; `health_flag` `"Coach Review Needed"` or `""`; `health_flag_reasons` string[]. Any reason sets the flag.

**Extractable** into V2 Rules Engine as declarative `{ fieldKey, operator, value, flagKey }` with a fixed label. Do not let an LLM invent medical conclusions.

No medical-diagnosis language found in code.

---

## Security Findings

Do not fix in this phase. Severity as assessed from the repo.

| Severity | Finding | Files |
| --- | --- | --- |
| **Critical** | Session cookie stores the dashboard password in plaintext. Theft of cookie = theft of the shared secret. | `app/api/coach/login/route.ts`, `lib/coach/session.ts` |
| **High** | Single shared password. No users, rotation, lockout, or audit of who viewed PHI-like health answers. | `proxy.ts`, login route |
| **High** | Google private key and sheet id live only in server env (good), but the workbook is the only copy of health data. Sheet ACL is the real tenant boundary. | `.env.local` (gitignored), `lib/sheets/client.ts` |
| **Medium** | Public POST `/api/onboarding` has no rate limit, captcha, or honeypot. | `app/api/onboarding/route.ts` |
| **Medium** | Notes API: no CSRF (SameSite=lax mitigates some), no max length, IDOR prevented only by cookie. | `app/api/coach/notes/route.ts` |
| **Medium** | `updateCoachNotes` column letter A–Z only. | `lib/sheets/repository.ts` |
| **Low** | Login `next` query unused. Open redirect not currently exploited because it is unused. | `proxy.ts`, `LoginForm.tsx` |
| **Low** | No `NEXT_PUBLIC_*` Google credentials. Sheet id is not shipped to the browser. | `.env.example` |
| **Info** | Submit failures log a static string only. No health payload in logs. | `app/api/onboarding/route.ts` |
| **Info** | Client JSON parse of localStorage is try/catch; prototype pollution not an issue for this draft shape but drafts are trusted into React state. | `OnboardingFlow.tsx` |

Service account JSON must stay server-side. `.env.example` documents names only.

---

## Testing Gaps

No unit, integration, or e2e tests. No Sheets mocks. Scripts `scripts/post-test-onboarding.mjs` and `scripts/verify-submission.mjs` are manual live-sheet checks.

**Minimum regression suite before refactoring the V1 renderer (Phase 2):**

1. `validateStep` / `validateSubmission`: required, enum, unknown keys, acknowledgements, height cm vs ft_in, weight lb vs kg, conditional details.
2. `buildHealthFlags`: each trigger and the empty-flag path.
3. Renderer: step order, Continue blocked on errors, Back, autosave restore, success clears storage, failure keeps storage (component tests or Playwright).
4. Conditional visibility: injury/medical/macros.
5. Contract: POST body keys ⊆ allowlist; response includes `submission_id`.
6. Later: Sheets repository mocked at `googleapis` boundary.

Until that exists, Phase 2 is high regression risk.

---

## KEEP / REFACTOR / REPLACE / REMOVE Matrix

| Path | Responsibility | Class | Reason | V2 destination |
| --- | --- | --- | --- | --- |
| `app/onboarding/ui/fields.tsx` | Field, ChoiceList, MultiChoice, Scale, CheckRow | KEEP | Generic controls | Schema renderer primitives |
| `app/globals.css` + fonts in `layout.tsx` | Visual system | KEEP / REFACTOR | Brand later becomes workspace branding | Design tokens + `/settings/branding` |
| `lib/onboarding/constants.ts` | Enums + `labelOf` | REFACTOR | Move into FormVersion options | First schema fixture |
| `lib/onboarding/types.ts` | Draft/validated/stored | REFACTOR | Generated from schema | `answers: Record<string, unknown>` + typed fixture |
| `lib/onboarding/validate.ts` | Step + submit validation | REFACTOR | Engine from schema; drop numeric steps | Form-engine validators |
| `lib/onboarding/health-flags.ts` | Deterministic flags | KEEP (extract) | Already isolated, not diagnostic | Rules Engine seed |
| `lib/onboarding/format.ts` | Age/height/weight/list | KEEP | Display helpers | Client/submission UI |
| `lib/onboarding/field-map.ts` | 94-key catalog + columns | REFACTOR | Becomes schema export / Sheets destination map | FormVersion + GoogleSheetsDestination |
| `lib/onboarding/service.ts` | Stamp + flags + persist | REFACTOR | Persist to DB first; destination async | Submission service |
| `app/onboarding/OnboardingFlow.tsx` | Entire form | REFACTOR | Split shell vs schema vs special fields | `/f/[slug]` renderer + V1 fixture |
| `app/page.tsx` | Mount form at `/` | REFACTOR | Public slug later | Redirect or keep as Emmanuel alias |
| `app/api/onboarding/route.ts` | Public POST | REFACTOR | Version-aware validate; canonical DB | `POST /api/f/[slug]/submit` |
| `lib/sheets/client.ts` | JWT client | KEEP | Good boundary | Integration auth |
| `lib/sheets/repository.ts` | Tabs, append, list, notes | REFACTOR | Destination adapter; stop using as app DB | `GoogleSheetsDestination` |
| `proxy.ts` + `lib/coach/session.ts` | Password cookie | REPLACE | Not multi-tenant auth | Better Auth (or Clerk) middleware |
| `app/api/coach/login\|logout` | Password cookie | REPLACE | Same | Session endpoints |
| `app/coach/login` | Gate UI | REFACTOR | Visual keep; identity change | Sign-in |
| `app/coach/onboarding/*` | List/detail/notes | REFACTOR | Layout keep; data from DB; schema-aware detail | `/clients`, `/forms/.../submissions` |
| `app/api/coach/notes` | Notes write | REFACTOR | DB notes; workspace ACL | Client/submission notes API |
| `scripts/*` | Live Sheets helpers | KEEP (ops) | Not product | Dev/ops until destination exists |
| Root metadata “Emmanuel” | Single-brand | REFACTOR | Workspace profile | CoachingProfile |

Nothing needs **REMOVE** before a replacement exists. Do not delete Sheets code until Phase 7 destination works.

---

## Schema Engine Migration Proposal

Safest path: **do not rewrite UX first**. Encode the current form as a typed fixture `forms/emmanuel-onboarding-v1.ts` that the existing renderer reads. Keep `OnboardingFlow` as a shell (progress, autosave, submit). Replace per-step JSX with `section.fields.map`.

Align with V2 architecture types:

```ts
OnboardingSchema { title, description?, estimatedMinutes?, sections, success }
FormSection { id, key, title, description?, position, fields }
FormField { id, key, type, label, description?, placeholder?, required, options?, validation?, logic?, position, metadata? }
ConditionalLogic { action: "show", all?: Condition[], any?: Condition[] }
```

**Preserve `key` = current field_key** (`full_name`, `height_unit`, …). Generate `id` as stable UUIDs in the fixture so publish/versioning later does not reshuffle keys.

**Validation in schema:** `required`, `min`/`max`, option lists, `logic.show`. Keep **server** validation generated from the same schema object (one source). Height pairing and unit-dependent ranges go in `metadata` or a dedicated field type — do not invent JS expressions.

**Unit mapping:**

- Preferred: specialized type `unit_number` with `metadata: { units: [...], companions: { ft_in: "height_inches" }, rangesByUnit }`.
- Fallback: three generic fields (`height_value`, `height_unit`, `height_inches`) plus `logic` on inches. UX is worse (separate questions). **Keep a specialized HeightField / WeightField renderer.**

**Specialized renderers justified (do not force generic):**

- Height (cm vs ft+in)
- Weight + unit
- `Scale` 1–5 (already a primitive in V2 types)
- `acknowledgement` / `CheckRow`
- Welcome / success screens (schema `success` + optional `intro` section type)

**Generic mapping:** short_text, long_text, email, phone, date, number, single_select (`ChoiceList`), multi_select (`MultiChoice`), boolean.

**Cannot cleanly fit without metadata:** meal cluster (breakfast/lunch/dinner) is three long_text fields — keep as three keys, optional visual group in `metadata.group`. Macro cluster same.

**Autosave:** key becomes `onboarding_draft:${formVersionId}` (or slug). Persist `step` + `answers`.

**Coach detail:** later render from the same schema (label from field, value from answers) instead of hard-coded `Item`s. Phase 2 can keep the current detail page.

---

## Application Database Recommendation

**Recommend: Neon Postgres + Drizzle ORM + Better Auth.**

Why this repo: Next 16 App Router / Vercel-style serverless, TypeScript-first, need migrations and multi-tenant SQL, early-stage cost, no current ORM to migrate. Neon pairs with serverless (HTTP driver). Drizzle stays close to SQL and matches upcoming Form/FormVersion/JSON answer columns. Better Auth is TypeScript-native and covers User, session, and later organization/workspace plugins without putting auth in a second SaaS if cost matters.

| Option | Fit | Tradeoff |
| --- | --- | --- |
| **Neon + Drizzle + Better Auth** | Best default | You own schema and auth wiring |
| Neon + Drizzle + **Clerk** | Faster hosted auth | Cost; another vendor; still need workspace tables |
| **Supabase** (Postgres + Auth) | One vendor | V1 PRD avoided Supabase; RLS is extra discipline; Auth ≠ Better Auth |
| **Convex** | Nice later for agent threads | Extra runtime beside Next; not required by V2 docs; weaker fit for relational tenancy + SQL migrations today |
| PlanetScale / generic Postgres | Fine | Neon is the least-friction serverless Postgres for this stack |

**Do not install in Phase 0.**

Migration implication: introduce DB **beside** Sheets. Dual-write is optional and should wait until Submission exists (Phase 5) or start dual-write only after Phase 1 if you want a safety copy. Canonical cutover is Phase 5–7, not Phase 1.

---

## Authentication Recommendation

Replace the password cookie with **Better Auth** (magic link or google signing) + `Workspace` / `WorkspaceMember`. Protect `/dashboard`, `/forms`, `/clients`, `/settings` on the server by session → membership → `workspaceId`. Public `/` and `/f/[slug]` stay unauthenticated.

**Migration from current gate:**

1. Keep `/coach/*` working on the old cookie until at least one User exists.
2. Add `/login` (or reuse `/coach/login` UI) issuing Better Auth session cookies (signed session id, **not** the password).
3. Seed one workspace (Emmanuel) and one owner user.
4. Point coach list/detail at the same Sheets reads, scoped only by “this single workspace” until Phase 5.
5. Remove `COACH_DASHBOARD_PASSWORD` and `emmanuel_coach` cookie.
6. Roles later: `owner` / `coach` / `assistant` on `WorkspaceMember`. Do not invent a permission matrix in Phase 1.

Clerk is an acceptable substitute if you want hosted MFA and less auth code; still add workspace tables in your DB.

---

## V1 → V2 Data Migration

| Current | V2 |
| --- | --- |
| Hard-coded `OnboardingFlow` + constants + FIELD_MAP | Form Draft / first published **FormVersion** (`schema_version` metadata `onboarding_v1`) |
| CLIENTS row | **Client** is not 1:1 today. Identity is `submission_id`. Match later by email+workspace; allow many Submissions per Client |
| ONBOARDING_RESPONSES row | **Submission** answers JSON + field keys preserved |
| `schema_version = onboarding_v1` | FormVersion.version + `legacySchemaVersion` |
| `health_flag` / reasons / `coach_review_needed` | ReviewFlag rows; `reviewStatus` |
| `coach_notes` | Notes on Client or Submission (today notes hang off submission row) |
| Google Sheets workbook | `GoogleSheetsDestination` for that workspace |

**Cannot migrate cleanly:**

- No stable Client id (email is not unique-constrained; duplicates append).
- CLIENTS is a projection, not a source of full answers (full payload is RESPONSES).
- `current_weight` composite vs structured weight keys.
- FIELD_MAP sheet may drift from code (seed-once).
- Autosave drafts are browser-only — they do not migrate.
- No workspace_id / form_id on existing rows — all attach to the seed workspace.

Import path: read RESPONSES as canonical, join notes from CLIENTS by `submission_id`, insert Submission + Client(email). Flag collisions for manual merge.

---

## Route Migration

| Now | V2 | Phase |
| --- | --- | --- |
| `/` | Keep as public Emmanuel form **or** redirect to `/f/[slug]` | 3+ |
| — | `/dashboard` | 1 |
| — | `/forms`, `/forms/new`, `.../build`, `.../preview`, `.../submissions` | 3 |
| `/coach/onboarding` | `/clients` and/or form submissions list | 5 (alias in 1) |
| `/coach/onboarding/[id]` | `/clients/[clientId]` and submission panel | 5 |
| `/coach/login` | `/login` | 1 |
| — | `/settings`, `/settings/profile`, `/settings/branding`, `/settings/connections` | 1 (profile), 7 (connections) |
| `/api/onboarding` | versioned public submit | 2–5 |
| `/api/coach/*` | session APIs + notes | 1 / 5 |

Phased: **do not create all V2 routes in Phase 1.** Phase 1 needs `/login`, `/dashboard`, `/settings/profile`, and can alias `/coach/onboarding` so the current review workflow does not break.

---

## Phase-by-Phase V2 Recommendation

| Phase | Fit for this repo | Prerequisites | Conflicts | Proposed change | Risk |
| --- | --- | --- | --- | --- | --- |
| **0 Audit** | Done | — | — | This document | — |
| **1 Foundation** | Appropriate | Env secrets stay server-side; `/` stays public | Cookie auth vs new session; do not wrap public form in login | Keep Sheets + `/` unchanged. Add DB/auth/workspace only around new `/dashboard`. **Add Vitest (+ Playwright smoke) here**, not only in Phase 2 acceptance | Medium (auth footguns), Low if `/` untouched |
| **2 Schema engine** | Appropriate and the highest product-risk phase | Tests from Phase 1; fixture of 86 keys | `validateStep(n)` vs schema; height/weight special UI | Do **not** swap persistence. Extract renderer + validation only. Keep POST contract identical | **High** without tests; Medium with tests |
| **3 Form management** | Appropriate after 2 | Schema renderer; workspace | Single STORAGE_KEY; `/` vs `/f/[slug]` | Introduce slug; keep `/` wired to published V1 version | Medium |
| **4 Agent builder** | Appropriate only after 3 | Draft model, bounded ops | Temptation to let the model edit DB freely | Follow plan: Draft only, no publish, no arbitrary SQL | Medium/High (scope) |
| **5 Client/Submission** | Required before leaving Sheets | Authz tests | CLIENTS row ≠ Client | Import existing rows into seed workspace | High (data model) |
| **6 Review intelligence** | Lift `health-flags.ts` first | Submission model | Mixing AI into flags | Ship deterministic flags before any brief | Low (flags) / Medium (AI) |
| **7 Connections** | Reuse `lib/sheets/*` | Canonical DB submit | Dual-write ordering; FIELD_MAP seed-once | Success = DB; Sheets async + retry | Medium |
| **8 Hardening** | Required | All above | Cookie leftovers, public abuse | Rate limit public submit; tenant tests | Medium |

**Should phases change?** Keep the order. Do **not** pull Agent (4) forward. Do **not** make Sheets optional before Phase 5. **Do** pull a test harness into Phase 1. Optional: a short Phase 1b “V1 contract tests” if Phase 1 auth slips.

A schema-engine-first reorder (2 before 1) would protect the live form but delays multi-tenant identity. Not necessary if Phase 1 is forbidden from editing `OnboardingFlow`.

---

## Highest-Risk Changes

1. Schema-driven renderer that silently drops conditionals, units, or acknowledgements.
2. Treating CLIENTS as Client while duplicates exist.
3. Making submit succeed only after Sheets (already true) — worse if dual-write is added incorrectly.
4. Replacing the cookie without a rollback path while coach review is in daily use.
5. No tests today — any refactor is unguarded.
6. `ensureHeader` / FIELD_MAP seed-once — column drift after schema evolution.

---

## Recommended First Implementation Phase

**Phase 1 — Product Foundation**, with explicit non-goals:

- Do not change `OnboardingFlow`, `validate.ts` rules, or Sheets write path.
- Do not add AI.
- Leave `/` public.
- Add Neon + Drizzle + Better Auth, User / Workspace / WorkspaceMember / CoachingProfile, protected `/dashboard` and `/settings/profile`.
- Alias or keep `/coach/onboarding` behind the **new** session once seeded.
- Add Vitest for `validate` + `health-flags` as the start of the Phase 2 safety net.

---

## Files Likely to Change in Phase 1

Expected **new:** DB schema/migrations, auth config, `app/dashboard/`, `app/login/` (or adapted coach login), `app/settings/profile/`, workspace helpers, `.env.example` keys for `DATABASE_URL` and auth secrets.

Expected **touch:** `package.json`, `proxy.ts` (or Next middleware) for new session cookies, `app/layout.tsx` only if a logged-in chrome is added **without** wrapping `/`.

Expected **unchanged:** `app/onboarding/**`, `lib/onboarding/validate.ts`, `lib/onboarding/health-flags.ts`, `lib/sheets/**`, `app/api/onboarding/route.ts`.

---

## Open Questions

1. Keep `https://…/` as the client URL forever, or move to `/f/[slug]` with a redirect?
2. Import existing Sheet rows into the seed workspace in Phase 5, or freeze V1 workbook as archive-only?
3. One workspace per coach vs team workspaces from day one?
4. Better Auth vs Clerk — cost vs speed?
5. Dual-write Sheets as soon as Submission exists, or wait for Phase 7?
6. Rate limiting / bot protection on public submit before real clients use `/f/[slug]`?
7. Should `gym_name` become conditional on training location when encoding the schema (behavior change) or stay always-visible (behavior freeze)?
8. Notes belong on Client, Submission, or both?

---

*End of Phase 0 audit. No code changes were made beyond adding this file.*
