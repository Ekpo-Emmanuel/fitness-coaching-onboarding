# V2 Product Spec — Agent-First Fitness Coaching Onboarding

## Status
Planning document for V2.

V1 is a standalone onboarding application for one coach, using Next.js, Google Sheets, and a thin coach review interface.

V2 turns the onboarding system into a multi-coach product.

V2 is **not a CRM**.

---

# 1. Product Definition

V2 is an **agent-first onboarding platform for fitness coaches**.

A coach describes their coaching business and what they need to learn about new clients. The AI agent creates the onboarding experience, the coach reviews and publishes it, clients complete it, and the platform converts each submission into structured coaching context that can be reviewed and synced to external systems.

## Core promise

> Build your client onboarding by talking to AI.

Instead of manually creating dozens of fields, a coach can say:

> “I coach beginner men aged 20–35 who want to build muscle. Most train 3–5 days per week in commercial gyms. I need health screening, training history, nutrition, lifestyle, goals and coaching preferences. Keep it under 10 minutes.”

The agent creates the initial onboarding draft.

After a client submits, the platform should transform a large response set into a useful coach-facing picture while preserving the original answers.

---

# 2. Product Boundary

V2 owns:

- Create
- Edit
- Preview
- Publish
- Collect
- Review
- Summarize
- Connect/export

V2 does **not** own:

- workout programming
- meal-plan generation
- payments
- contracts
- sales pipelines
- lead management
- weekly check-ins
- habit tracking
- workout logging
- client messaging
- scheduling
- full coaching delivery

These may integrate with the product later, but they are not V2 responsibilities.

---

# 3. Core Product Loop

Coach creates workspace  
→ creates Coaching Profile  
→ asks Agent to create onboarding  
→ Agent generates draft  
→ Coach reviews/edits  
→ Coach previews  
→ Coach publishes  
→ Coach shares branded link  
→ Client completes onboarding  
→ Submission is validated and stored  
→ deterministic review rules run  
→ AI creates Coach Brief  
→ Coach reviews submission  
→ data syncs to configured destinations

The platform must preserve a clear separation between:

1. Client-provided facts
2. Deterministic review flags
3. AI-generated summaries or suggestions

---

# 4. First-Time Coach Onboarding

## Step 1 — About your coaching

Collect:

- business name
- coach name
- coaching type:
  - online
  - hybrid
  - in-person
  - nutrition
  - other

## Step 2 — Who do you coach?

Prompt:

**Who do you primarily help?**

Allow natural-language description.

Optional structured values:

- typical age range
- typical training experience
- common goals
- common training environments

The product should not force the coach through an excessive setup form.

AI may extract structured context from the coach’s natural-language description.

## Step 3 — How do you coach?

Ask:

- What information do you normally need before creating a program?
- Do you provide nutrition coaching?
- Do you require health/injury screening?
- Do you coach online, in person, or both?
- Any special programming considerations?

## Step 4 — Brand

Collect:

- logo
- primary brand color
- business name

Later versions may add:

- custom fonts
- additional colors
- custom domains

## Step 5 — Data destination

For V2:

- Google Sheets
- Webhook
- Connect later

---

# 5. Coaching Profile

The Coaching Profile is persistent workspace-level context used by the Agent.

Suggested shape:

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

  brand: {
    logoUrl?: string;
    primaryColor?: string;
  };

  createdAt: string;
  updatedAt: string;
};
```

The goal is that a coach can later say:

> “Create a new onboarding for my clients.”

and the Agent already has useful business context.

---

# 6. Primary Product Surfaces

V2 should contain six major product areas:

1. Dashboard
2. Agent Builder
3. Visual Form Editor
4. Preview + Publish
5. Clients / Submissions
6. Connections

---

# 7. Dashboard

Route:

`/dashboard`

Purpose:

Provide a lightweight overview, not deep analytics.

Suggested content:

- greeting
- Create Onboarding CTA
- Ask Agent CTA
- forms count
- clients count
- submissions count
- needs-review count
- recent submissions
- existing forms

Do not turn this into a full analytics product.

---

# 8. Creating an Onboarding

Route:

`/forms/new`

Primary interface:

**What would you like to create?**

Large natural-language Agent input.

Example:

> Describe the clients you coach and what you need to learn before coaching them.

Also offer starting templates:

- Online Coaching
- Bodybuilding
- Muscle Building
- Fat Loss
- Strength
- Hybrid Coaching
- Blank

Templates are starting context, not rigid final forms.

---

# 9. Agent Builder

Route:

`/forms/[formId]/build`

The Agent is the primary creation interface.

The form preview/editor is the control layer.

Suggested desktop layout:

```text
┌──────────────────────────┬────────────────────────────┐
│                          │                            │
│        AI AGENT          │       FORM PREVIEW         │
│                          │                            │
│ Conversation + proposed  │ Sections, questions,       │
│ changes                  │ logic and structure        │
│                          │                            │
└──────────────────────────┴────────────────────────────┘
```

Mobile may use tabs or stacked panels.

---

# 10. Agent Capabilities

The Agent may operate on drafts.

## Create

Example:

> Create an onboarding for beginner bodybuilding clients.

May create:

- sections
- fields
- labels
- descriptions
- options
- required states
- conditional logic

## Add

> Add a section about supplements.

## Remove

> Remove all nutrition questions.

## Modify

> Make the health section shorter.

## Reorder

> Put lifestyle before nutrition.

## Conditional logic

> Only ask injury details if they report an injury.

## Simplify

> Get this under eight minutes.

## Adapt

> Make this appropriate for hybrid coaching.

## Tone

> Make the questions more conversational.

## Review

> Critique this onboarding.

The Agent may identify:

- duplicate questions
- unnecessary questions
- missing information
- overly long sections
- confusing labels
- inconsistent conditional logic
- completion-time risks

---

# 11. Agent Change Control

AI may modify **drafts**.

AI must not silently modify or republish a live form.

For meaningful changes, present a proposal.

Example:

> Remove nutrition from this onboarding.

Proposed change summary:

- Remove Nutrition section
- Remove 11 questions
- Remove nutrition-related conditional logic
- Estimated completion time: 10 → 7 minutes

Action:

**Apply changes**

Small edits may support immediate application with Undo.

Coach approval is always required before publication.

---

# 12. Visual Editor

AI-first does not mean AI-only.

A coach must be able to directly edit:

- section title
- section description
- question label
- description
- placeholder
- field type
- required state
- options
- validation
- conditional logic
- order

Support manual section and question reordering.

Internal keys should remain visible in an advanced/details area where useful but should not dominate the UX.

---

# 13. Supported Field Types

V2 should support at minimum:

```ts
type FieldType =
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
```

Future field types may be added without changing the overall form model.

---

# 14. Preview

Route:

`/forms/[formId]/preview`

Preview should use the same rendering system as the public form.

Support:

- mobile preview
- desktop preview

Default to mobile because the public onboarding experience is mobile-first.

Do not maintain a separate fake preview renderer.

---

# 15. Publishing and Versioning

Every form has a mutable draft and immutable published versions.

Example:

```text
Form
├── Draft
├── Version 1
├── Version 2
└── Version 3
```

Rules:

- Editing a form updates Draft only.
- Publishing creates a new immutable FormVersion.
- Existing published versions are never mutated.
- Every submission references the exact FormVersion used.
- Historical submissions must remain renderable even after the form evolves.

---

# 16. Public Client Form

Suggested route:

`/f/[slug]`

Client-facing experience should remain:

- mobile-first
- branded to the coach
- premium
- simple
- focused
- free of dashboard navigation
- free of unnecessary SaaS chrome

The V1 onboarding UX should be reused where appropriate.

---

# 17. Client Model

A Client is not the same thing as a Submission.

Suggested shape:

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

A client may have multiple submissions over time.

---

# 18. Submission Model

Suggested shape:

```ts
type Submission = {
  id: string;

  workspaceId: string;
  clientId: string;

  formId: string;
  formVersionId: string;

  answers: Record<string, unknown>;

  reviewStatus: "new" | "needs_review" | "reviewed";

  submittedAt: string;
};
```

Potential future examples of submissions:

- initial onboarding
- reassessment
- nutrition intake
- injury update
- coaching feedback

V2 only needs to support initial onboarding well, but the data model should not prevent expansion.

---

# 19. Submission Processing

Flow:

Submission  
→ server validation  
→ persistence  
→ deterministic rules  
→ AI summary generation  
→ coach-facing Client Summary  
→ integration sync

Do not use AI for deterministic conditions.

Example:

If `current_injuries === true`, the rules engine may set:

`coachReviewNeeded = true`

No AI call is needed for that.

---

# 20. Client Summary

Route:

`/clients/[clientId]`

Show:

## Snapshot

- primary goal
- training experience
- training availability
- training environment
- review status

## Goals

Structured client-provided information.

## Training

Structured client-provided information.

## Health

Original responses and deterministic flags.

## Nutrition

Original responses and useful normalized information.

## Recovery

Sleep, stress, work schedule, schedule challenges.

## Coaching Preferences

Feedback style, consistency challenges, biggest concern.

The coach must always be able to access the original client answers.

---

# 21. AI Coach Brief

Display AI-generated content separately from client-provided facts.

Example:

## AI Coach Brief

> Whitney’s primary focus is lower-body muscular development, particularly quads and glutes. She reports limited structured strength-training experience and can realistically train three days per week.

### Things to review

- Previous knee discomfort reported
- Training consistency has previously been difficult
- Client reports uncertainty with compound movements

### Kickoff conversation topics

- Clarify the circumstances surrounding knee discomfort
- Confirm a realistic weekly training schedule
- Discuss exercise-confidence concerns

The AI may organize and summarize.

It must not:

- diagnose a condition
- medically clear the client
- claim an exercise is safe for a specific injury
- prescribe medication
- automatically reject a client based on health answers

---

# 22. AI Summary Provenance

Suggested shape:

```ts
type AISummary = {
  id: string;
  workspaceId: string;
  submissionId: string;

  summary: string;

  sourceFieldKeys: string[];

  generatedAt: string;
};
```

The UI should be able to communicate which submitted information influenced the AI summary.

This improves trust and debuggability.

---

# 23. Clients List

Route:

`/clients`

Suggested columns:

- Client
- Goal
- Submitted
- Health / Review
- Status

Suggested filters:

- All
- Needs Review
- New
- Reviewed

Search by client name/email.

Keep this intentionally lightweight.

---

# 24. Connections

Route:

`/settings/connections`

Initial destinations:

## Google Sheets

Connect and configure where structured onboarding data is sent.

## Webhook

Send normalized submission payloads to a coach-provided endpoint.

Webhook support enables connection to:

- Zapier
- Make
- n8n
- custom CRMs
- custom applications

without requiring a native integration for every service.

---

# 25. Data Ownership

The V2 application database is the source of truth.

Google Sheets is an external destination/integration.

The application must not depend on a successful Google Sheets sync to retain a submitted onboarding.

If an external sync fails:

- keep the internal submission
- mark integration delivery as failed
- allow retry
- do not lose client information

---

# 26. Multi-Tenancy

Everything belongs to a workspace.

Examples:

- CoachingProfile
- Form
- FormVersion
- Client
- Submission
- AISummary
- Integration

Every server-side read/write must be scoped to the authenticated workspace.

Do not rely on client-provided workspace IDs for authorization.

---

# 27. Authentication and Roles

V2 needs real account authentication.

Minimum role:

- Owner

Architecture should allow later roles such as:

- Coach
- Assistant
- Admin

Do not build a large role-management system in V2 unless required.

---

# 28. Agent Safety Boundaries

Agent MAY:

- generate onboarding drafts
- modify onboarding drafts
- summarize submissions
- identify reported information requiring coach review
- suggest missing questions
- identify redundant questions
- suggest kickoff discussion topics

Agent MUST NOT:

- diagnose medical conditions
- medically clear clients
- claim an exercise is safe for a reported condition
- prescribe medication
- automatically reject clients based on health answers
- publish forms without coach approval
- silently alter published versions
- delete historical submissions without explicit confirmation

---

# 29. Data Export / Deletion

Design toward:

- export client data as JSON
- export submissions as CSV
- delete client data
- delete workspace data

Not every advanced privacy workflow must be built immediately, but the core data model must support data ownership and deletion.

---

# 30. Route Map

Target route structure:

```text
/
  marketing site

/login
/signup

/onboarding
  coach setup

/dashboard

/forms
/forms/new
/forms/[formId]/build
/forms/[formId]/preview
/forms/[formId]/submissions

/clients
/clients/[clientId]

/settings
/settings/profile
/settings/branding
/settings/connections

/f/[slug]
  public client onboarding
```

---

# 31. V2 Success Criteria

V2 succeeds when a new fitness coach can:

1. Create an account.
2. Describe their coaching business.
3. Ask the Agent to create an onboarding.
4. Review/edit the draft.
5. Preview the exact client experience.
6. Publish a version.
7. Share a branded URL.
8. Receive a real client submission.
9. See deterministic review flags.
10. See an AI Coach Brief.
11. Access the original answers.
12. Sync the submission to Google Sheets or a webhook.

That complete loop matters more than adding more features.
