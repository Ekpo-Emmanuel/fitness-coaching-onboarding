# Phase 5 Implementation Report

Phase 5 adds an Agent Builder on top of the existing Form Draft lifecycle. Coaches converse in the builder. The model proposes structured operations. The application validates them, stores an AgentChangeSet, and applies only after the coach clicks Apply. The Agent cannot publish or write Drafts directly.

## Status

**Complete** for the Phase 5 product boundary. No Coach Brief, submission AI, Rules Engine, or Sheets destination.

## AI provider

Official `openai` SDK. Responses API with `json_object` output. Domain code depends on `FormAgentProvider`; `OpenAIFormAgentProvider` is the only implementation.

## Model configuration

`lib/ai/config.ts` reads `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4.1-mini`). No `NEXT_PUBLIC_*` AI secrets. Model ID is not scattered through UI.

## Agent architecture

Coach message → server loads Workspace, Form, Draft, Coaching Profile, recent thread messages → provider → parse operations → simulate with `applyAgentOperations` → validate schema + identity → store ChangeSet + assistant message. Apply/Reject are separate authenticated routes.

## Database migration

`drizzle/0003_phase5_agent.sql` applied on development Neon. PGlite tests apply 0000–0003.

## AgentThread

One primary thread per Form (`form_id` unique). Workspace-owned. Cascades with Form. Does not control FormVersion.

## AgentMessage

`user` | `assistant` text only. Optional `changeSetId`. No chain-of-thought or secrets.

## AgentChangeSet

`proposed` | `applied` | `rejected` | `superseded`. Stores `baseDraftRevision`, summary, operations JSON, human-readable details, provider/model metadata.

## AgentOperation types

`update_form_metadata`, `update_intro`, `update_success`, `create_section`, `update_section`, `delete_section`, `move_section`, `create_field`, `update_field`, `delete_field`, `move_field`, `set_field_options`, `set_field_validation`, `set_field_logic`, `set_client_identity_mapping`.

Creates use `tempRef` / `sectionRef` / `fieldRef`. Application generates IDs. No `replace_entire_schema`.

## Operation validation

Untrusted model JSON. Limits on operations, new sections/fields, options, text length. Keys must be snake_case; collisions get a deterministic suffix. Logic must reference existing keys. Result must pass `parseOnboardingSchema` / `validateSchemaDefinition` and identity mapping checks.

## Draft revision safety

ChangeSet records the draft revision at proposal time. Apply requires `status = proposed` and matching revision. Otherwise the set is marked `superseded`. No auto-merge. Double-apply is rejected.

## Apply transaction

`getPoolDb()` transaction: auth + ownership, re-run operations, validate, `updateDraft` (revision increment), optional rename, mark applied. Failure rolls back.

## Coaching Profile context

Server sends business name, coach name, types, target clients, goals, experience, nutrition flag, health-screening flag, philosophy, programming notes. Profile is not mutated by Agent turns.

## Agent system rules

Server-side prompt: useful onboarding, low friction, identity collection, no medical clearance, no unsupported field types, nutrition intake only when the profile says the coach provides it.

## Builder UI

`/forms/[formId]/build`: Agent column + existing visual editor on desktop. Mobile tabs: Agent / Editor / Preview. Conversation persists in Postgres. ChangeSet cards with Apply / Reject / View details. Apply updates editor state without a full reload. Publish remains a separate control. Unpublished draft changes do not alter the live FormVersion.

## `/forms/new` AI-first flow

Recommended path: **Create with AI** creates a blank Form/Draft in the app, then opens `?agent=1`. Manual and V1-copy starts remain.

## Error handling

Missing/invalid key, rate limit, timeout, malformed JSON, invalid operations. UI copy: the Agent could not complete the request; the form was not changed. Retry via sending again.

## Security

Session + Workspace on every Agent route. Thread and ChangeSet queries require `workspaceId + formId`. Browser cannot supply trusted workspace, schema, or profile. Model output cannot publish, archive, or touch Clients/Submissions. `/api/forms` without a session returns 401 (JSON) via proxy.

## Tests

Vitest **87 passed**, including operation types, stale/reject/double-apply, workspace isolation, published-version immutability, mocked provider/context (no live API). Playwright **9 passed**, including mocked Agent propose/apply/reject/failure on the development sandbox page. No test spends OpenAI credits.

Optional: `npm run test:agent-live` (requires `OPENAI_API_KEY`, not in CI).

## OpenAI mocking

ChangeSet tests inject `FormAgentProvider`. Playwright intercepts `/api/forms/**/agent*`.

## Build verification

| Check | Result |
| --- | --- |
| TypeScript (`next build`) | Pass |
| ESLint | Pass (unused imports cleaned) |
| Vitest | 87 passed |
| Playwright | 9 passed |
| Production build | Pass |
| `db:migrate` | `0003_phase5_agent` applied |

## Manual verification

Not walked logged-in against live OpenAI in this session. Do the product loop in the spec after setting `OPENAI_API_KEY`.

## Environment variables

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## Known limitations

- One thread per Form
- No Agent-driven publish
- No submission/client data in prompts
- Completion time is an estimate
- Invalid model proposals become assistant text, not an applicable ChangeSet
- `/dev/agent-sandbox` exists for Playwright; production `NODE_ENV` returns not found

## Phase 6 readiness

Drafts can be Agent-edited under coach control. Historical FormVersions and canonical Submissions are unchanged. Phase 6 (review intelligence) was not started.
