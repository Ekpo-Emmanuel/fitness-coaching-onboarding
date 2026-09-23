# PHASE_6_IMPLEMENTATION_REPORT.md

## Status

Phase 6 Review Intelligence is implemented. Canonical Submissions stay the source of truth. Deterministic ReviewFlags and AI Coach Briefs are stored separately.

## Database migration

Added `drizzle/0004_phase6_review.sql` and journal entry `idx: 4`.

- `form_draft.review_rules` JSONB (nullable)
- `form_version.review_rules` JSONB (nullable)
- `review_flag` table with unique `(submission_id, code)`
- `coach_brief` table with unique `submission_id`
- indexes on workspace, submission, and CoachBrief status

PGlite tests apply 0000–0004.

## ReviewRuleSet architecture

`review_rules_v1` JSON:

- unique rule ids and codes
- factual labels
- `all` / `any` conditions using existing schema operators
- `sourceFieldKeys`
- no executable JavaScript

Validation lives in `lib/review/validate.ts`. Evaluation is pure in `lib/review/evaluate.ts`.

## FormDraft/FormVersion versioning

Draft rules are editable. Publish snapshots `draft.reviewRules` onto the new FormVersion. Historical versions keep their own JSON. Evaluation always uses `Submission.formVersion.reviewRules`, never the current Draft.

Null rules remain valid. No generic flags are generated when rules are missing.

## V1 rule compatibility

Seeded V1 rules encode the existing `lib/onboarding/health-flags.ts` triggers as descriptive Coach Review Needed flags.

Chosen strategy for already-published V1 versions: **backfill review metadata only** when `review_rules` is null and the schema is the exact known V1 key set (`isLegacyV1Schema`). Schema snapshots are not rewritten. New `seed:v1-form` publishes with `V1_REVIEW_RULES`. Client-facing questions are unchanged.

Legacy `/` still uses `health-flags.ts` and Google Sheets.

Import maps `health_flag_reasons` into ReviewFlags when the FormVersion has no rules.

## ReviewFlag model

Workspace-scoped, Submission-owned, deterministic. No LLM writes this table. Mark Reviewed does not delete flags.

## Rule evaluation

`evaluateReviewRules({ rules, answers, schema })` uses `isLogicSatisfied`. No database, AI, or network.

## Submission integration

Public `/f/[slug]` persist path:

1. validate FormVersion + answers
2. evaluate FormVersion review rules
3. transaction: Client, Submission, ReviewFlags, `reviewStatus`, pending CoachBrief

AI is not in the transaction.

## Review status

- no flags → `new`
- one or more flags → `needs_review`
- coach Mark Reviewed → `reviewed`

AI cannot change `reviewStatus`.

Clients list status uses **latest Submission by `submittedAt`**.

## CoachBrief model

Separate `coach_brief` row per Submission. Status: `pending` → `processing` → `complete` | `failed`. Payload is structured JSON, not embedded on Submission.

## AI provider

`SubmissionIntelligenceProvider` is separate from `FormAgentProvider`. Implementation: `OpenAISubmissionIntelligenceProvider`.

## Model configuration

`OPENAI_COACH_BRIEF_MODEL` falls back to `OPENAI_MODEL`. No `NEXT_PUBLIC_*` secrets.

## Model input minimization

Input excludes email, phone, full name, date of birth, database ids, workspace ids, and session data. The model is instructed to say “the client”. Sensitive answers are not logged.

## CoachBrief structure

`summary` plus optional sourced lists: goals, training, nutrition, lifestyleRecovery, coachingPreferences, thingsToReview, kickoffTopics.

## Provenance

Every item requires `sourceFieldKeys` that exist on the FormVersion schema. Invented keys and unknown top-level fields fail validation.

## Generation lifecycle

No fake background jobs. Persist creates `pending`. When an authenticated coach opens Submission detail, the UI requests `POST /api/submissions/[submissionId]/coach-brief/generate`. Concurrent requests CAS `pending|failed` → `processing`. Complete briefs are not regenerated unless the status is `failed` and `retry: true`.

## Failure/retry behavior

Provider/malformed output → `failed`. Submission and flags remain. UI: “Coach Brief couldn't be generated.” + Retry. No stack traces.

## Submission detail UX

Separate blocks:

1. Client header + Needs Review / Reviewed
2. Snapshot cards for known V1 keys when present
3. Submitted Information
4. Deterministic Review Flags
5. AI Coach Brief with expandable sources

Things to Review keeps Review flags and AI clarification visually distinct.

## Agent ReviewRule integration

Operations: `create_review_rule`, `update_review_rule`, `delete_review_rule`. Same `baseDraftRevision` ChangeSet safety. Invalid field references blocked. Medical-risk labels rejected. Published versions unchanged until Publish.

## Security

Private routes resolve session → Workspace → Submission. `/api/submissions` is session-gated in `proxy.ts`. No public Coach Brief. No cross-submission AI context.

## Tests

Coverage includes rule validation, V1 evaluation triggers, persist atomicity, versioned rules, Agent operations/ChangeSets, Coach Brief validation/PII, lifecycle/retry/concurrency, workspace isolation, Playwright mocked intelligence UI, plus existing Phase 1–5 and V1 suites.

## Build verification

See session completion notes for TypeScript, ESLint, Vitest, Playwright, and production build.

## Manual verification

Local product test still required on Neon: publish health screening, submit trigger and non-trigger answers, generate brief, mark reviewed, publish a new rule version, confirm old flags unchanged. `npm run test:coach-brief-live` is optional and spends OpenAI credits.

## Environment variables

- existing: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- optional: `OPENAI_COACH_BRIEF_MODEL`

## Known limitations

- Snapshot cards only know a small set of V1 keys (`primary_goal`, `training_experience`, `training_days_available`, `gym_name`). Arbitrary forms rely on the AI Brief.
- Medical-label rejection is a small heuristic, not a classifier.
- No durable job queue; generation starts when a coach opens the Submission.
- No Coach Brief history/regenerate-when-complete.
- Optional public-form preview of “this answer would trigger” was not added.
- Phase 7 connections and Phase 8 export/deletion are not built.

## Phase 7 readiness

Canonical Submission + versioned ReviewRules + isolated Coach Brief are in place. Destination adapters (Sheets/webhooks/CRM) can consume Submission + flags without treating AI as source of truth.
