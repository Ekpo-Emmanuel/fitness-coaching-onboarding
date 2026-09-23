# V2 Architecture — Agent-First Fitness Coaching Onboarding

## Status
Architecture target for V2.

This document describes the intended product architecture. It does not require an immediate rewrite of V1.

---

# 1. Architectural Principle

V1 currently behaves approximately like:

```text
Next.js Client Form
        ↓
Next.js API
        ↓
Google Sheets
```

That is appropriate for a single-coach internal tool.

V2 should become:

```text
                    ┌──────────────────┐
                    │   Coach Web App  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Application    │
                    │   Service Layer  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼───────────────┐
              │              │               │
      ┌───────▼───────┐ ┌────▼─────┐ ┌──────▼──────┐
      │ App Database  │ │ AI Layer │ │ Rules Engine │
      └───────┬───────┘ └──────────┘ └─────────────┘
              │
      canonical source of truth
              │
      ┌───────▼──────────────────────────────┐
      │          Integration Layer           │
      ├─────────────────┬────────────────────┤
      │ Google Sheets   │ Webhook            │
      └─────────────────┴────────────────────┘
```

Google Sheets moves from **database** to **destination/integration**.

---

# 2. Core Design Rules

## Rule 1 — Application database is canonical

All important V2 product state belongs in the application database.

This includes:

- users
- workspaces
- coaching profile
- forms
- drafts
- form versions
- clients
- submissions
- AI summaries
- integrations
- delivery status

External destinations must never be the only copy of submission data.

## Rule 2 — Forms are schema-driven

The public client renderer must not rely on hard-coded question components tied to one onboarding.

The UI renders a FormVersion schema.

## Rule 3 — Published versions are immutable

Published form versions never change.

Editing modifies Draft.

Publishing creates a new FormVersion.

## Rule 4 — Every entity is workspace-scoped

Multi-tenancy is enforced server-side.

## Rule 5 — AI never becomes the source of truth

AI generates:

- drafts
- proposed edits
- summaries
- suggestions

Structured product state remains deterministic and validated.

## Rule 6 — External systems are adapters

Google Sheets, webhooks, CRMs, and other systems are integration destinations behind a common interface.

---

# 3. Suggested Domain Model

```text
User
 │
Workspace
 ├── Members
 ├── CoachingProfile
 ├── Forms
 │    ├── Draft
 │    └── FormVersions
 │
 ├── Clients
 │    └── Submissions
 │          ├── ReviewFlags
 │          └── AISummary
 │
 ├── AgentThreads
 │
 └── Integrations
      ├── GoogleSheets
      └── Webhook
```

---

# 4. Workspace

Suggested conceptual model:

```ts
type Workspace = {
  id: string;
  name: string;

  createdAt: string;
  updatedAt: string;
};
```

Every product-level entity belongs to a workspace.

---

# 5. Membership

```ts
type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;

  role: "owner";

  createdAt: string;
};
```

Keep roles minimal in V2 but do not bake single-user assumptions into data access.

---

# 6. Coaching Profile

```ts
type CoachingProfile = {
  id: string;
  workspaceId: string;

  businessName: string;
  coachName: string;

  coachingTypes: string[];
  targetClientDescription: string;

  typicalGoals: string[];
  typicalExperienceLevels: string[];

  providesNutritionCoaching: boolean;
  requiresHealthScreening: boolean;

  coachingPhilosophy?: string;
  programmingConsiderations?: string;

  logoUrl?: string;
  primaryColor?: string;

  createdAt: string;
  updatedAt: string;
};
```

The Agent receives this as persistent workspace context where appropriate.

---

# 7. Form

`Form` is the stable identity.

```ts
type Form = {
  id: string;
  workspaceId: string;

  name: string;
  slug: string;

  status: "draft" | "published" | "archived";

  activePublishedVersionId?: string;

  createdAt: string;
  updatedAt: string;
};
```

---

# 8. Form Draft

Draft is mutable.

```ts
type FormDraft = {
  id: string;
  workspaceId: string;
  formId: string;

  schema: OnboardingSchema;

  updatedAt: string;
};
```

The Agent and Visual Editor operate on Draft.

---

# 9. Form Version

Published versions are immutable.

```ts
type FormVersion = {
  id: string;
  workspaceId: string;
  formId: string;

  versionNumber: number;
  schemaVersion: string;

  schema: OnboardingSchema;

  publishedAt: string;
  publishedByUserId: string;
};
```

Never modify `schema` after creation.

---

# 10. Onboarding Schema

Suggested high-level type:

```ts
type OnboardingSchema = {
  title: string;
  description?: string;

  estimatedMinutes?: number;

  sections: FormSection[];

  success: {
    title: string;
    message: string;
  };
};
```

---

# 11. Form Section

```ts
type FormSection = {
  id: string;

  key: string;
  title: string;
  description?: string;

  position: number;

  fields: FormField[];
};
```

Section `key` should remain stable where possible.

---

# 12. Form Field

```ts
type FormField = {
  id: string;

  key: string;

  type:
    | "short_text"
    | "long_text"
    | "number"
    | "email"
    | "phone"
    | "date"
    | "single_select"
    | "multi_select"
    | "boolean"
    | "scale"
    | "acknowledgement";

  label: string;

  description?: string;
  placeholder?: string;

  required: boolean;

  options?: Array<{
    label: string;
    value: string;
  }>;

  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };

  logic?: ConditionalLogic;

  position: number;

  metadata?: Record<string, unknown>;
};
```

The schema should be extensible without exposing arbitrary executable code.

---

# 13. Conditional Logic

Avoid storing JavaScript expressions.

Use structured logic.

Example:

```ts
type ConditionalLogic = {
  action: "show";

  all?: Condition[];
  any?: Condition[];
};

type Condition = {
  fieldKey: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "is_empty"
    | "is_not_empty";

  value?: unknown;
};
```

This allows:

> Show injury details when current_injuries equals true.

Logic should be validated when saving/publishing.

---

# 14. Client

```ts
type Client = {
  id: string;
  workspaceId: string;

  fullName: string;
  email: string;
  phone?: string;

  createdAt: string;
  updatedAt: string;
};
```

Client identity rules should be explicit.

For V2, email can be used to detect an existing client within the same workspace, but avoid irreversible merging based solely on assumptions.

---

# 15. Submission

```ts
type Submission = {
  id: string;
  workspaceId: string;

  clientId: string;

  formId: string;
  formVersionId: string;

  answers: Record<string, unknown>;

  reviewStatus:
    | "new"
    | "needs_review"
    | "reviewed";

  submittedAt: string;
};
```

Store answers by stable field key.

Do not store only rendered question labels.

---

# 16. Deterministic Review Flags

Suggested model:

```ts
type ReviewFlag = {
  id: string;
  workspaceId: string;
  submissionId: string;

  code: string;
  label: string;

  severity: "review";

  sourceFieldKeys: string[];

  createdAt: string;
};
```

Examples:

- CURRENT_INJURY_REPORTED
- EXERCISE_RESTRICTION_REPORTED
- MEDICAL_CONSIDERATION_REPORTED
- MEDICATION_CONSIDERATION_REPORTED
- PREGNANCY_CONSIDERATION_REPORTED

These flags indicate only that coach review is needed.

They do not diagnose or medically classify the client.

---

# 17. AI Summary

```ts
type AISummary = {
  id: string;
  workspaceId: string;
  submissionId: string;

  summary: string;

  thingsToReview: string[];
  kickoffTopics: string[];

  sourceFieldKeys: string[];

  generatedAt: string;

  status:
    | "pending"
    | "complete"
    | "failed";
};
```

The original submission remains usable if AI generation fails.

AI summary failure must not block client onboarding submission.

---

# 18. Agent Threads

Suggested conceptual structure:

```ts
type AgentThread = {
  id: string;
  workspaceId: string;

  formId?: string;

  createdByUserId: string;

  createdAt: string;
  updatedAt: string;
};
```

Messages may be stored separately.

Agent threads should not be required to render or publish a form.

---

# 19. Agent Operations

Do not allow the model to directly mutate arbitrary database state.

Expose bounded application operations such as:

- create_section
- update_section
- delete_section
- reorder_section
- create_field
- update_field
- delete_field
- reorder_field
- set_field_logic
- update_form_metadata

The AI returns structured proposed operations.

The application validates them.

Then the user applies them.

This is preferable to asking the model to regenerate an entire form blob after every small change.

---

# 20. Agent Change Set

Suggested concept:

```ts
type AgentChangeSet = {
  id: string;
  workspaceId: string;
  formId: string;

  status:
    | "proposed"
    | "applied"
    | "rejected";

  summary: string;

  operations: AgentOperation[];

  createdAt: string;
};
```

This supports:

- review
- approval
- undo strategies
- auditability

---

# 21. Authentication

Replace the V1 shared password/cookie coach gate with real user authentication.

Required qualities:

- authenticated sessions
- server-side workspace resolution
- protected dashboard routes
- no trust in client-supplied ownership identifiers

Avoid building authentication from scratch if a reliable supported solution is available.

---

# 22. Authorization

Every server-side operation should conceptually follow:

```text
authenticated user
    ↓
resolve allowed workspace
    ↓
load entity by entityId + workspaceId
    ↓
perform operation
```

Never load by entity ID first and assume authorization afterward.

This applies to:

- forms
- versions
- clients
- submissions
- summaries
- integrations
- agent threads

---

# 23. Public Form Security

Public forms require no coach authentication.

However:

- resolve Form by public slug
- use only active published version
- never expose Draft
- never expose integration credentials
- validate submitted fields against published schema
- reject unknown fields where appropriate
- apply rate-limiting/abuse controls appropriate to deployment
- store server-side timestamps
- generate server-side submission IDs

---

# 24. Submission Validation

Submission validation should use the exact published FormVersion schema.

Validate:

- required fields
- allowed field keys
- data types
- valid option values
- min/max rules
- acknowledgement fields
- conditional-field expectations where appropriate

Do not trust client-side validation alone.

---

# 25. Client Autosave

Public form autosave can remain local in V2.

Do not persist incomplete sensitive onboarding responses server-side by default.

Potential future server-side draft/resume support should require an explicit design decision.

---

# 26. Application Service Layer

Avoid UI components directly calling integration adapters or database internals.

Conceptual layers:

```text
UI
 ↓
Server Action / Route Handler
 ↓
Application Service
 ↓
Repository / Domain Logic
 ↓
Database / AI / Integration Adapter
```

Example:

```text
submitOnboarding()
  ├── validateAgainstFormVersion()
  ├── resolveOrCreateClient()
  ├── createSubmission()
  ├── createReviewFlags()
  ├── requestAISummary()
  └── dispatchIntegrationDeliveries()
```

---

# 27. Integration Interface

Suggested shape:

```ts
interface SubmissionDestination {
  sendSubmission(
    context: DestinationContext,
    submission: CanonicalSubmission
  ): Promise<IntegrationResult>;
}
```

Initial implementations:

- GoogleSheetsDestination
- WebhookDestination

Future implementations:

- CRM destinations
- coaching platforms
- automation platforms

---

# 28. Integration Records

Suggested model:

```ts
type Integration = {
  id: string;
  workspaceId: string;

  type: "google_sheets" | "webhook";

  status: "connected" | "error" | "disabled";

  config: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};
```

Secrets should be stored using secure server-side mechanisms appropriate to the chosen infrastructure.

Never expose secrets through browser payloads.

---

# 29. Integration Delivery

Track delivery independently of the submission.

```ts
type IntegrationDelivery = {
  id: string;
  workspaceId: string;

  integrationId: string;
  submissionId: string;

  status:
    | "pending"
    | "sent"
    | "failed";

  lastError?: string;
  attemptCount: number;

  createdAt: string;
  updatedAt: string;
};
```

A failed Google Sheets or webhook delivery must not delete or invalidate the canonical submission.

---

# 30. Google Sheets V2 Role

The existing V1 Sheets implementation should be refactored into an integration adapter.

Potential output tabs may remain:

- CLIENTS
- ONBOARDING_RESPONSES
- FIELD_MAP

But the spreadsheet is no longer responsible for product identity, authorization, versioning, or canonical storage.

---

# 31. Webhook Destination

Webhook payload should use a stable versioned contract.

Example:

```json
{
  "event": "onboarding.submitted",
  "payload_version": "1",
  "workspace_id": "...",
  "client": {},
  "submission": {},
  "form": {}
}
```

Do not expose unrelated internal records or secrets.

Future webhook signing should be considered.

---

# 32. V1 Renderer Migration

The V1 form UI should be reused where possible.

Target transition:

```text
Hard-coded V1 questions
        ↓
Schema-driven V2 renderer
```

Preserve:

- mobile-first UX
- progress navigation
- local autosave
- conditional fields
- validation
- unit controls
- success/failure handling

Replace the source of configuration.

Instead of JSX defining the onboarding structure, the published schema defines it.

---

# 33. Preview Renderer

Preview and public onboarding should call the same shared renderer.

Conceptually:

```tsx
<OnboardingRenderer
  schema={schema}
  mode="preview"
/>
```

and:

```tsx
<OnboardingRenderer
  schema={publishedVersion.schema}
  mode="public"
/>
```

Differences between preview/public should be minimal and intentional.

---

# 34. Draft Editing

Form updates should not require publishing.

Suggested write flow:

Editor / Agent  
→ validate change  
→ persist Draft  
→ preview Draft  
→ explicit Publish  
→ create immutable FormVersion

---

# 35. Publishing Transaction

Publishing should validate:

- unique field keys
- valid field types
- valid option sets
- conditional logic references existing fields
- no circular/invalid conditions where applicable
- required metadata
- success screen exists
- schema can be rendered

Only a valid Draft may be published.

---

# 36. AI Generation Strategy

Agent input context may include:

- CoachingProfile
- current Draft schema
- current form metadata
- recent conversation context
- bounded product rules

Agent output should prefer structured operations over unvalidated free-form data.

The application remains responsible for:

- schema validation
- persistence
- authorization
- publication

---

# 37. AI Submission Summary Strategy

Input:

- published schema
- normalized submission answers
- deterministic flags

Output:

- concise coach brief
- things to review
- kickoff discussion topics
- source field keys

Do not ask the model to determine whether a client is medically safe to exercise.

---

# 38. Failure Handling

## AI failure

Submission remains saved.

Display:

AI Coach Brief unavailable / retry.

## Google Sheets failure

Submission remains saved.

Integration delivery = failed.

Allow retry.

## Webhook failure

Submission remains saved.

Integration delivery = failed.

Allow retry.

## Publish failure

Draft remains intact.

No partial FormVersion should become active.

---

# 39. Observability

At minimum, log operational failures without logging unnecessary sensitive response contents.

Useful events:

- submission accepted
- submission validation failed
- AI summary failed
- integration delivery failed
- publish failed

Avoid logging:

- full health answers
- medication details
- private notes

unless specifically necessary and appropriately secured.

---

# 40. Privacy / Sensitive Data Architecture

Fitness onboarding may contain sensitive information.

Architect for:

- least-privilege access
- workspace isolation
- server-side authorization
- controlled exports
- data deletion
- secure secrets
- minimal sensitive logging
- explicit coach access

The product should surface health-related answers to the coach without converting them into medical conclusions.

---

# 41. Suggested Project Module Boundaries

Exact folders depend on the current repository, but conceptually:

```text
src/
  app/
    dashboard/
    forms/
    clients/
    settings/
    f/

  components/
    onboarding/
    forms/
    agent/
    clients/

  domain/
    forms/
    clients/
    submissions/
    integrations/

  services/
    forms/
    submissions/
    agent/
    integrations/

  integrations/
    google-sheets/
    webhook/

  validation/
    forms/
    submissions/

  auth/

  db/
```

Do not reorganize the entire codebase solely to match this example.

Use it as a boundary guide.

---

# 42. Technology Decision Still Required

V2 needs a real application database.

Do not choose one merely because it appeared in this document.

Evaluate the current codebase and choose based on:

- compatibility with Next.js
- type safety
- migrations / schema evolution
- multi-tenancy
- serverless deployment
- development speed
- long-term maintainability
- security model
- cost at early-stage usage

Convex may be a candidate, but it is not automatically mandated.

The V1-to-V2 audit should recommend the database choice separately.

---

# 43. Migration Principle

Do not rewrite V1 from scratch unless the audit proves reuse is more expensive or unsafe.

Preferred approach:

1. identify reusable V1 components
2. isolate hard-coded assumptions
3. introduce schema types
4. make current V1 onboarding render from a schema
5. preserve behavior with tests
6. add V2 product layers around it

---

# 44. Architectural Definition of Done

The V2 architecture is working when:

- a workspace owns all private entities
- real authentication protects coach data
- a coach can create a draft form
- forms are rendered from schemas
- publishing produces immutable versions
- public submissions reference exact versions
- submissions are stored internally before external sync
- deterministic flags work without AI
- AI summaries are additive, not required for submission success
- Google Sheets is a destination, not canonical storage
- webhook delivery is independently retryable
- historical submissions remain readable
