# V2 Implementation Plan — V1 to Agent-First Product

## Status
Phased implementation plan.

## Core rule

Do not attempt to build V2 in one large change.

Each phase must leave the repository in a runnable, testable state.

Do not move to the next phase while the current phase has unresolved data-loss, authorization, rendering, or migration defects.

---

# Phase 0 — Audit V1

## Goal

Understand the existing implementation before changing architecture.

## Required output

Create an audit that identifies:

- current routes
- current form architecture
- hard-coded question locations
- validation system
- conditional logic implementation
- autosave implementation
- Google Sheets integration
- coach authentication/gate
- coach list/detail screens
- health review logic
- field mapping implementation
- reusable UI components
- reusable server/data code
- coupling that will block V2

Classify each significant V1 area as:

- KEEP
- REFACTOR
- REPLACE
- REMOVE

Do not change application behavior in this phase.

---

# Phase 1 — Product Foundation

## Goal

Introduce real product identity and multi-tenancy without rebuilding the onboarding experience.

## Build

- application database
- authentication
- User model
- Workspace model
- WorkspaceMember model
- CoachingProfile model
- protected product routes
- workspace-aware server utilities
- initial setup/onboarding flow for coaches

## Preserve

Existing V1 client onboarding should remain functional during this phase if practical.

## Do not build yet

- Agent form generation
- form versions
- webhooks
- AI submission summaries

## Acceptance criteria

- user can sign up/log in
- user belongs to a workspace
- dashboard routes are protected
- server resolves workspace from authentication
- workspace-scoped records cannot be read across tenants
- Coaching Profile can be created and edited

---

# Phase 2 — Schema Engine

## Goal

Convert V1 from a hard-coded onboarding to a schema-driven renderer while preserving V1 behavior.

## Build

Core types:

- OnboardingSchema
- FormSection
- FormField
- ConditionalLogic

Create the current V1 onboarding as a schema fixture/data object.

Refactor the client form renderer so the same V1 onboarding is rendered from the schema.

## Preserve exactly where reasonable

- section order
- field labels
- required states
- conditional questions
- progress indicator
- Back / Continue
- mobile UX
- local autosave
- validation
- health acknowledgement
- final acknowledgement
- submission behavior

## Acceptance criteria

- current onboarding works end-to-end
- no form question depends on hard-coded route/component logic unnecessarily
- conditional fields are schema-driven
- validation is schema-driven where practical
- stable field keys are preserved
- tests cover important V1 behavior

---

# Phase 3 — Form Management, Drafts and Versioning

## Goal

Turn the schema engine into a workspace-owned onboarding product where coaches can create, edit, preview and publish multiple onboarding forms.

This phase establishes the deterministic lifecycle that future submissions and Agent operations will depend on.

Core lifecycle:

```text
Workspace
  ↓
Form
  ↓
Mutable Draft
  ↓
Preview
  ↓
Publish
  ↓
Immutable FormVersion
  ↓
Public URL
```

## Build

### Data model

* `Form`
* `FormDraft`
* `FormVersion`
* draft revision / optimistic concurrency
* immutable published schema snapshots
* active published version reference
* public slug
* archive state

### Product routes

* `/forms`
* `/forms/new`
* `/forms/[formId]/build`
* `/forms/[formId]/preview`
* `/f/[slug]`

### Manual visual editor

Support:

* form title / description
* intro content
* success content
* add/edit/delete sections
* reorder sections
* add/edit/delete fields
* reorder fields
* edit labels/descriptions/placeholders
* required state
* choices/options
* validation settings
* conditional logic
* duplicate fields
* stable field keys
* stable section keys

### Preview

Preview must use the same `OnboardingRenderer` used by public forms.

Preview must not create real submissions or write to external systems.

### Publish

Publishing must:

1. validate the Draft
2. create an immutable FormVersion
3. increment the version number
4. update the Form's active published version
5. occur atomically

## Schema cleanup

Normalize:

```ts
estimatedMinutes
```

from presentation text such as:

```text
8–12
```

into structured data such as:

```ts
{
  min: 8,
  max: 12
}
```

The renderer may convert that structure back into user-facing text.

## Rules

* editing changes Draft only
* Draft is mutable
* published FormVersions are immutable
* publishing creates a new version rather than modifying an old one
* public route uses only the active published FormVersion
* public route never exposes Draft
* field IDs remain stable
* field keys remain stable when labels change
* section keys remain stable when titles change
* schema JSON loaded from the database must be structurally validated
* private reads/writes must be workspace-scoped
* browser-supplied `workspaceId` is never trusted for authorization
* draft revision conflicts must not silently overwrite newer edits

## Existing V1 compatibility

The existing V1 onboarding at:

```text
/
```

must remain operational.

The existing legacy submission endpoint and Google Sheets behavior must remain operational.

The existing V1 onboarding should also be seedable into the new Form system as:

```text
Form
  ↓
Draft
  ↓
Published Version 1
```

The seeded schema must preserve all existing stable client field keys.

## Generic submission boundary

Phase 3 does **not** introduce the final generic Submission model.

Therefore:

* arbitrary new Forms may be created
* arbitrary new Forms may be previewed
* arbitrary new Forms may be published
* arbitrary published Forms may render publicly

but generic response collection must not be presented as production-ready until Phase 4.

Do not weaken the existing V1 `/api/onboarding` validator to accept arbitrary schemas.

Do not create a temporary generic response table or temporary Google Sheets workaround.

The existing V1 form may continue using its existing submission path until canonical Submission persistence is implemented.

## Acceptance criteria

* coach can create multiple Forms
* each Form belongs to the authenticated Workspace
* each Form has one mutable Draft
* coach can manually edit the Draft
* coach can add/remove/reorder sections
* coach can add/remove/reorder/edit fields
* labels may change without silently changing stable field keys
* Draft changes persist
* draft revision conflicts are detected
* preview uses the shared renderer
* preview creates no real submissions
* first publish creates Version 1
* editing Draft does not change Version 1
* second publish creates Version 2
* Version 1 remains unchanged
* active published version updates atomically
* `/f/[slug]` renders only the active published version
* unpublished and archived forms are not publicly available
* Workspace A cannot read or modify Workspace B forms
* existing `/` onboarding remains operational
* existing V1 Sheets submission remains operational
* all existing Phase 1 and Phase 2 tests remain green

---

# Phase 4 — Client and Canonical Submission Model

## Goal

Create the canonical data layer for people completing onboarding forms.

Stop treating a spreadsheet row as the application's client record.

After this phase, the application database—not Google Sheets—becomes the source of truth for new generic onboarding submissions.

Core lifecycle:

```text
Published FormVersion
       ↓
Public Client Form
       ↓
Validated Answers
       ↓
Client
       ↓
Submission
       ↓
Canonical Database
```

## Build

### Client model

Add:

* `Client`
* workspace ownership
* full name
* email
* optional phone
* timestamps

A Client may have multiple Submissions.

Do not make:

```text
Client === Submission
```

### Submission model

Add:

* `Submission`
* workspaceId
* clientId
* formId
* formVersionId
* answers
* submittedAt
* reviewStatus
* schema/version metadata where useful

Answers must preserve stable field keys.

### Generic public submission endpoint

Create a public submission flow for `/f/[slug]`.

The server must:

1. resolve Form by public slug
2. resolve active published FormVersion
3. validate submitted answers against that exact immutable schema
4. reject unknown fields
5. reject invalid option values
6. enforce required fields
7. enforce conditional requirements
8. generate IDs/timestamps server-side
9. resolve or create Client
10. persist Submission
11. return success only after canonical persistence succeeds

### Client resolution

For V2, email may help identify an existing Client within the same Workspace.

Do not perform destructive or irreversible merges solely because two submissions use the same email.

Design this conservatively.

### Product routes

* `/clients`
* `/clients/[clientId]`
* `/forms/[formId]/submissions`

### Client list

Support:

* name
* email
* most recent submission
* form
* basic status
* search

Do not build a full CRM.

### Client detail

Show:

* Client identity
* submission history
* selected Submission
* original submitted answers
* exact FormVersion used

The coach must always be able to inspect original client answers.

## Submission version integrity

Every Submission must reference:

```text
Form
+
exact FormVersion
```

Never render historical answers against whichever schema happens to be current.

If:

```text
Submission A → Version 1
Submission B → Version 3
```

each must remain interpretable using its own schema snapshot.

## Existing V1 data

Do not discard existing Google Sheets submissions.

Provide a migration/import strategy using:

```text
ONBOARDING_RESPONSES
```

as the primary source of full responses.

Join:

```text
CLIENTS
```

using:

```text
submission_id
```

where needed for coach notes/projection data.

Attach historical records to the existing owner Workspace.

Handle duplicate emails conservatively.

Historical imports should preserve:

```text
schema_version = onboarding_v1
```

as legacy metadata.

## Existing `/` route

The existing V1 route may remain temporarily operational during migration.

Once canonical generic submission behavior has parity, the product may later move Emmanuel's onboarding fully onto `/f/[slug]`.

Do not remove the legacy route until verified.

## Important

External integrations must not be required for successful canonical submission persistence.

Submission success must depend on:

```text
Application Database
```

not:

```text
Google Sheets
Webhook
CRM
AI
```

## Acceptance criteria

* public published forms can accept real submissions
* submission validation uses the exact FormVersion
* submitted FormVersion cannot change afterward
* valid submission creates or links a Client
* Submission references Client, Form and exact FormVersion
* original answers remain available
* one Client may have multiple Submissions
* `/clients` works
* `/clients/[clientId]` works
* `/forms/[formId]/submissions` works
* Workspace boundaries are enforced
* external integration failure cannot destroy a canonical Submission
* arbitrary Forms no longer depend on the legacy 86-field V1 endpoint
* existing V1 historical data has a documented safe migration path

---

# Phase 5 — Agent Builder

## Goal

Make natural-language interaction the primary onboarding creation workflow.

At this point the product already has:

```text
Schema Engine
  ↓
Form
  ↓
Draft
  ↓
FormVersion
  ↓
Public Form
  ↓
Client
  ↓
Submission
```

The Agent now operates on top of a deterministic product instead of filling architectural gaps.

## Build

### Agent interface

* Agent conversation UI
* Agent thread storage
* form-aware context
* Coaching Profile context
* current Draft context

### Agent operations

Implement bounded structured operations such as:

* create section
* update section
* delete section
* reorder section
* create field
* update field
* delete field
* reorder field
* update field options
* update validation
* set conditional logic
* update form metadata

Do not give the model arbitrary database mutation capability.

### Agent change sets

Add:

* proposed changes
* human-readable change summary
* operation list
* apply
* reject
* optional recent-change undo

Suggested lifecycle:

```text
Coach Prompt
   ↓
Agent
   ↓
Proposed Change Set
   ↓
Validation
   ↓
Coach Review
   ↓
Apply to Draft
```

## Initial Agent capabilities

### Create

> Build me an onboarding for beginner online bodybuilding clients.

### Add

> Add a section about supplements.

### Remove

> Remove most of the nutrition questions.

### Modify

> Make the health section shorter.

### Reorder

> Put lifestyle before nutrition.

### Conditional logic

> Only ask injury details if they report an injury.

### Simplify

> Make this take less than eight minutes.

### Adapt

> Make this suitable for hybrid coaching.

### Tone

> Make these questions sound more conversational.

### Critique

> Review this onboarding and tell me what is missing or redundant.

## Agent context

The Agent may use:

* Coaching Profile
* target clientele
* coaching type
* nutrition coaching preference
* health-screening preference
* current Form Draft
* current form metadata
* current Agent thread

## Rules

* Agent operates on Draft only
* Agent cannot publish
* Agent cannot modify published FormVersions
* Agent cannot bypass schema validation
* Agent cannot issue arbitrary SQL/database commands
* Agent changes must resolve Workspace ownership server-side
* meaningful edits should be reviewable before applying
* coach explicitly publishes after reviewing Draft
* AI failure must not corrupt Draft
* existing Draft revision/concurrency rules still apply

## Acceptance criteria

Coach can say:

> Build me an onboarding for beginner online bodybuilding clients.

and receive a valid editable Draft.

Coach can then say:

> Make it shorter and remove most nutrition questions.

and receive a proposed change set.

Coach can review the changes before applying them.

After application:

* Draft remains structurally valid
* visual editor reflects the changes
* Preview reflects the changes
* published version remains unchanged
* publication still requires explicit coach action

---

# Phase 6 — Review Intelligence

## Goal

Turn canonical Submissions into useful coaching context while clearly separating facts, deterministic flags and AI-generated interpretation.

Core flow:

```text
Submission
   ↓
Deterministic Rules
   ↓
Review Flags
   ↓
AI Coach Brief
   ↓
Coach Review
```

## Build

### Deterministic Rules Engine

Extract the proven V1 health-review logic into a reusable rules system.

Initial review flags may include:

* current injury reported
* previous injury requiring context
* surgery history reported
* exercise restriction reported
* medical consideration reported
* medication consideration reported
* pregnancy/postpartum consideration reported
* other health concern reported

Keep flags descriptive.

Use:

**Coach Review Needed**

Do not diagnose.

Do not determine exercise clearance.

### ReviewFlag model

Store:

* submissionId
* workspaceId
* rule/flag code
* human-readable label
* source field keys
* createdAt

### AI Coach Brief

Generate:

* concise client summary
* primary goals
* relevant training context
* availability
* lifestyle/recovery context
* coaching preferences
* things to review
* kickoff conversation topics
* source field keys

### AI provenance

Store which client answer fields materially informed the generated summary.

The coach should be able to distinguish:

```text
Client said this
```

from:

```text
AI summarized this
```

## UI

Clearly separate:

### Submitted Information

Original client answers.

### Review Flags

Deterministic system rules.

### AI Coach Brief

Generated interpretation/organization.

Never visually merge these into one undifferentiated narrative.

## Failure behavior

AI failure must never block:

* submission persistence
* coach access to answers
* deterministic flags
* Client creation

The UI should allow AI summary retry.

## AI boundaries

AI may:

* summarize
* organize
* identify information worth discussing
* identify possible missing context
* suggest kickoff conversation topics

AI must not:

* diagnose medical conditions
* medically clear a client
* say a client is safe for a specific exercise
* prescribe medication
* automatically reject a client because of health answers

## Acceptance criteria

* deterministic flags work without AI
* V1 health flag behavior remains represented
* AI summary can fail independently
* canonical Submission remains accessible
* original client answers remain visible
* AI output is clearly labeled
* source/provenance is stored
* no AI diagnosis or medical-clearance behavior
* coach may retry failed AI summary generation

---

# Phase 7 — Connections

## Goal

Turn the existing V1 Google Sheets persistence architecture into an optional integration layer.

The application database is already canonical by this stage.

Core flow:

```text
Canonical Submission
       ↓
Integration Dispatch
       ↓
┌───────────────────────┐
│ Google Sheets         │
│ Webhook               │
│ Future destinations   │
└───────────────────────┘
```

## Build

### Integration model

Add:

* Integration
* type
* Workspace ownership
* status
* configuration
* timestamps

Initial types:

* `google_sheets`
* `webhook`

### IntegrationDelivery

Track each attempt independently.

Include:

* integrationId
* submissionId
* status
* attempt count
* last error
* createdAt
* updatedAt

Suggested statuses:

* pending
* sent
* failed

### Adapter abstraction

Create an integration interface such as:

```ts
interface SubmissionDestination {
  sendSubmission(
    context: DestinationContext,
    submission: CanonicalSubmission
  ): Promise<IntegrationResult>;
}
```

Implement:

* `GoogleSheetsDestination`
* `WebhookDestination`

### Connections UI

Create:

```text
/settings/connections
```

Support:

* connect
* configure
* disable
* status
* delivery failures
* retry where appropriate

## Google Sheets migration

Reuse proven V1 Sheets techniques where appropriate.

Potential tabs may remain:

* `CLIENTS`
* `ONBOARDING_RESPONSES`
* `FIELD_MAP`

But Sheets must no longer determine:

* Client identity
* Form identity
* FormVersion identity
* authorization
* canonical Submission state

Google Sheets becomes an export/destination.

## Webhook

Send a stable versioned payload.

Example:

```json
{
  "event": "onboarding.submitted",
  "payload_version": "1",
  "client": {},
  "submission": {},
  "form": {}
}
```

Design toward signed webhooks.

Do not expose unrelated internal records or credentials.

## Delivery rules

Canonical submission flow:

```text
Persist Submission
       ↓
Success
       ↓
Attempt destinations
```

Never:

```text
Google Sheets failed
       ↓
Client submission lost
```

## Acceptance criteria

* internal Submission succeeds even when Sheets is unavailable
* Google Sheets failure is recorded independently
* failed delivery can be retried
* webhook delivery works independently
* Integration configuration is workspace-scoped
* secrets never reach browser
* integrations cannot access another Workspace
* disabling an Integration does not remove canonical data
* existing V1 Sheets implementation is either retired or cleanly wrapped as the destination adapter

---

# Phase 8 — Product Hardening

## Goal

Prepare V2 for real multi-coach production use.

This phase focuses on security, privacy, reliability, accessibility and deployment rather than adding major product features.

## Work

### Security

* tenant-isolation tests
* authorization tests
* public-form abuse protection
* rate limiting
* bot/spam mitigation where appropriate
* session/security review
* webhook security
* secret-handling review
* injection/input validation review

### Data and privacy

* sensitive logging review
* data export
* client deletion flow
* workspace deletion strategy
* integration-data deletion
* audit important destructive actions
* confirm health-related information is not unnecessarily logged

### Form reliability

* validation hardening
* Draft conflict testing
* publish/version regression testing
* historical FormVersion rendering
* malformed schema failure handling
* unavailable/archived form handling

### Submission reliability

* duplicate-submit handling
* retry/idempotency strategy where appropriate
* partial failure testing
* AI failure testing
* integration retry testing

### UX

* accessibility pass
* keyboard navigation
* screen-reader labels
* mobile testing
* tablet testing
* responsive builder testing
* loading states
* empty states
* error-state testing
* slow-network behavior

### Production

* deployment configuration
* production environment validation
* database migration process
* backup/recovery considerations
* monitoring/error reporting
* operational documentation

## Acceptance criteria

No known path may:

* expose another Workspace's private data
* allow one Workspace to mutate another Workspace's Forms or Clients
* mutate historical published FormVersions
* publicly expose Draft schemas
* lose a canonical Submission because an external integration failed
* require AI success for Submission success
* expose integration/database credentials to the browser
* show AI-generated interpretation as if it were client-provided fact
* silently overwrite a newer Draft revision
* permanently lose a Submission because of a retriable downstream failure

Public form flows must be usable on supported mobile devices and accessible with keyboard navigation.

---

# Deferred Beyond V2

Explicitly defer:

* workout program builder
* exercise programming engine
* meal-plan builder
* macro prescription engine
* Stripe
* payments
* agreements/contracts
* e-signatures
* sales CRM
* lead pipeline
* appointment booking
* messaging
* weekly check-ins
* habit tracking
* exercise/workout logging
* coaching delivery platform
* native mobile app
* advanced team permissions
* large analytics suite
* marketplace/templates ecosystem
* dozens of native integrations
* custom domains unless justified separately
* AI-generated workout programs
* AI-generated nutrition prescriptions

Adding these during V2 requires a deliberate product-scope decision.

The product remains:

```text
Create
→ Publish
→ Collect
→ Understand
→ Connect
```

not a full coaching operating system.

---

# Migration Strategy for Existing V1

This section reflects the current repository after Phase 1 and Phase 2.

## Completed

### Single coach → Workspace

Completed in Phase 1.

The application now has:

* real authentication
* Workspace
* WorkspaceMember
* CoachingProfile

### Shared password → real authentication

Completed in Phase 1.

The legacy plaintext password-cookie architecture has been replaced.

### Hard-coded questions → schema

Completed in Phase 2.

The existing V1 onboarding now exists as:

```text
emmanuelOnboardingV1
```

and renders through the shared schema engine.

### Shared browser/server validation

Completed in Phase 2.

The schema engine now drives both client and server validation.

### Structured conditional logic

Completed in Phase 2.

Hard-coded visibility conditions have been converted into serializable structured conditions.

---

# Existing V1 Assets to Keep

Keep and continue building on:

* mobile onboarding UX
* progress navigation
* large touch controls
* local autosave
* conditional field UX
* inline validation
* height/weight unit controls
* health acknowledgement
* final acknowledgement
* success/failure handling
* stable field keys
* stable field IDs
* schema validation
* shared renderer
* shared validation engine
* existing health-review behavior
* coach summary information hierarchy
* working Google Sheets API techniques
* Phase 1 authentication/workspace foundation

---

# Remaining Refactors

## Single schema fixture → Form lifecycle

Phase 3:

```text
emmanuelOnboardingV1
→ Form
→ FormDraft
→ FormVersion
```

## Spreadsheet row identity → Client + Submission

Phase 4:

```text
ONBOARDING_RESPONSES
→ Submission

CLIENTS projection
→ Client / submission-facing projection
```

## Direct Google Sheets persistence → integration adapter

Phase 7:

```text
Application database
→ canonical Submission

Google Sheets
→ optional destination
```

## Hard-coded coach submission rendering → schema-aware rendering

Implement as the Client/Submission UI evolves.

Historical submissions must render using the exact schema version they were submitted against.

## Hard-coded health flags → reusable Rules Engine

Phase 6.

Preserve the proven existing health behavior while extracting it.

---

# Architecture to Replace

The following V1 assumptions must not survive the completed V2 architecture:

* Google Sheets as canonical application database
* one onboarding form per application
* one coach per deployment
* one global browser autosave key for every future form
* submission identity being treated as Client identity
* private data reads without Workspace scoping
* public submission validation tied permanently to one 86-key schema
* hard-coded coach detail pages that cannot interpret arbitrary FormVersions

Do not remove a working legacy implementation until its replacement has proven parity.

---

# Current Phase Sequence

The implementation order is now:

```text
Phase 0
Repository Audit
      ↓
Phase 1
Product Foundation
Auth + Workspace + Database
      ↓
Phase 2
Schema Engine
      ↓
Phase 3
Forms + Drafts + Immutable Versions
      ↓
Phase 4
Clients + Canonical Submissions
      ↓
Phase 5
Agent Builder
      ↓
Phase 6
Review Intelligence
      ↓
Phase 7
Connections
      ↓
Phase 8
Product Hardening
```

The key sequencing principle is:

**AI is layered on top of a complete deterministic onboarding lifecycle.**

The Agent should not be responsible for compensating for missing Form, Version, Client or Submission architecture.

---

# Required Phase Discipline

Before each phase:

1. inspect current repository state
2. read previous implementation reports
3. identify affected files
4. identify invariants that must remain unchanged
5. state migration risks
6. write the implementation plan
7. implement the smallest coherent change
8. add/expand regression tests
9. run TypeScript
10. run lint
11. run unit/integration tests
12. run Playwright where relevant
13. run production build
14. verify affected user flows
15. summarize completed work
16. document remaining issues
17. stop before starting the next phase

Do not silently broaden scope.

Do not skip phases merely because later features are more visually exciting.

Do not replace proven V1 behavior merely because a different architecture appears cleaner.

Do not create temporary architecture that will immediately be discarded by the next phase unless there is a compelling migration reason.

Preserve working behavior while progressively removing hard-coded assumptions.

At the end of every phase, create or update a dedicated implementation report before beginning the next one.
