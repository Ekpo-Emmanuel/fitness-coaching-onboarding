# Stitch screen inventory

Source of truth: this repository as of the audit. No invented product features. Dev harnesses and redirect stubs are listed, then excluded from the recommended Stitch set.

Product name in UI: **Coaching**.

Current visual system: light paper/ink palette (`#e6ebe4` / `#1c241f`), accent green (`#2f6a4a`), Outfit display + Geist sans/mono, rounded-full buttons, rounded-2xl/3xl cards, top header (not a sidebar). Public onboarding uses a 72px desktop step rail and a sticky bottom bar.

---

# Product summary

Coaching is an AI-first client onboarding SaaS for fitness coaches.

Implemented loop:

1. Unauthenticated coach lands on `/`, signs up at `/signup`.
2. Completes workspace + coaching profile at `/onboarding`.
3. Lands on `/dashboard`.
4. Creates a form at `/forms/new` (AI-first, blank, or V1 copy).
5. Builds at `/forms/[formId]/build` with Agent + visual editor.
6. Reviews Agent Proposed Changes, Apply / Reject.
7. Previews at `/forms/[formId]/preview` (no real submit).
8. Publishes; client uses `/f/[slug]`.
9. Canonical Submission is stored; Review Flags are deterministic.
10. AI Coach Brief generates on the submission page.
11. Coach reviews at `/clients/...`; optional Google Sheets / webhook delivery from `/settings/connections`.

What does **not** exist in UI: billing, messaging, bookings, workout/nutrition programming, CRM pipeline, testimonials, pricing, metrics dashboards, toast system, authenticated sidebar, tablet-specific layouts, pagination controls, brand-color editor, typical-goals / experience-level profile fields.

---

# Navigation architecture

```text
PUBLIC
├── /                          SaaS landing (signed-out or signed-in header)
├── /login                     Coach sign in (also in-form Create account tab)
├── /signup                    Coach create account (same LoginForm, signup mode)
└── /f/[slug]                  Published client onboarding
    └── unavailable            Same route, unpublished/missing slug

COACH ACTIVATION (authenticated, no workspace yet)
└── /onboarding                Coaching profile + create workspace

COACH APP (requireWorkspace → AppShell header)
├── /dashboard
├── /forms
│   ├── /forms/new
│   ├── /forms/[formId]/build
│   ├── /forms/[formId]/preview
│   └── /forms/[formId]/submissions
├── /clients
│   ├── /clients/[clientId]
│   └── /clients/[clientId]/submissions/[submissionId]
└── /settings
    ├── /settings/profile
    └── /settings/connections

REDIRECTS (not product screens)
├── /coach/login               → /login
├── /coach/onboarding          → /clients
└── /coach/onboarding/[id]     → /clients

DEV ONLY (production notFound for legacy; not Stitch product)
├── /dev/legacy-onboarding
├── /dev/agent-sandbox
├── /dev/intelligence-sandbox
├── /dev/connections-sandbox
└── /dev/privacy-sandbox
```

**AppShell** (authenticated): logo/business name → `/dashboard`; links Dashboard, Forms, Clients, Settings, Connections; Sign out. Header wraps and stacks on small widths. No mobile bottom nav. No breadcrumbs except ad-hoc “Back to …” links.

**LandingNav**: sticky header; desktop section links + Log in / Get started (or Dashboard if signed in); mobile hamburger drawer.

---

# Complete route inventory

| # | Screen | Route | Audience | Desktop | Mobile | Priority |
| - | ------ | ----- | -------- | ------- | ------ | -------- |
| 01 | Landing | `/` | Unauthenticated coach; signed-in coach | Full | Full (hamburger) | High |
| 02 | Sign in | `/login` | Unauthenticated coach | Two-column | Stacked | High |
| 03 | Create account | `/signup` | Unauthenticated coach | Two-column | Stacked | High |
| 04 | Coach setup | `/onboarding` | Authenticated coach, no workspace | Form | Form | High |
| 05 | Dashboard | `/dashboard` | Authenticated coach | Cards + links | Stack | High |
| 06 | Forms list | `/forms` | Authenticated coach | List | List | High |
| 07 | Create form | `/forms/new` | Authenticated coach | Form + radios | Form | High |
| 08 | Form builder | `/forms/[formId]/build` | Authenticated coach | Agent + editor | Agent / Editor / Preview tabs | High |
| 09 | Form preview | `/forms/[formId]/preview` | Authenticated coach | Viewport toggle | Viewport toggle | High |
| 10 | Public onboarding | `/f/[slug]` | Public client | Step rail + sticky bar | Sticky bar | High |
| 11 | Form unavailable | `/f/[slug]` | Public client | Centered | Centered | Medium |
| 12 | Form responses | `/forms/[formId]/submissions` | Authenticated coach | Filter + list | List | Medium |
| 13 | Clients list | `/clients` | Authenticated coach | Search + chips + list | Same | High |
| 14 | Client detail | `/clients/[clientId]` | Authenticated coach | Identity + history | Same | High |
| 15 | Submission detail | `/clients/[clientId]/submissions/[submissionId]` | Authenticated coach | Narrow column (~max-w-3xl) | Same | High |
| 16 | Settings hub | `/settings` | Authenticated coach | Links + danger zone | Same | Medium |
| 17 | Coaching profile | `/settings/profile` | Authenticated coach | Form | Form | High |
| 18 | Connections | `/settings/connections` | Authenticated coach | Two integration cards + deliveries | Stack | High |

User-facing product routes: **18** (unavailable shares `/f/[slug]`). Redirect stubs: **3**. Dev harnesses: **5**. No `app` route groups. Root `app/layout.tsx` only.

Protection (`proxy.ts` matcher): `/login`, `/signup` public (signed-in users bounce to `/dashboard`). `/dashboard`, `/settings`, `/onboarding`, `/forms`, `/clients`, `/coach/*` require session cookie. `/` and `/f/[slug]` are **not** in the matcher (public). Missing workspace/profile: `requireWorkspace()` sends coach to `/onboarding`.

---

# Screen specifications

## SCREEN 01 — Landing

**Route:** `/`  
**Audience:** Unauthenticated coach; signed-in coach (header CTA changes).  
**Purpose:** Explain the product and send coaches to signup or login.

**Main content:**
- Hero: “Client onboarding, built with your AI agent.” CTAs Build your onboarding (`/signup`), Log in (`/login`). Decorative `LandingHeroVisual`.
- How it works (`#how-it-works`): 5 numbered steps (describe coaching → AI build → review/publish → understand client → connect tools).
- Agent-first (`#product`): copy + static `LandingStudio` mock (Agent chat, Proposed changes Apply/Reject, client preview chips). Not interactive.
- After submit: Submitted Information, Review flags, AI Coach Brief mock cards. Disclaimer: not a medical assessment.
- Connections (`#connections`): Google Sheets + Webhooks cards.
- Dark CTA band: Get started → `/signup`.
- Footer: Coaching, Log in, Get started.

**Primary actions:** Get started / Build your onboarding → `/signup`.  
**Secondary:** Log in; in-page anchors Product / How it works / Connections. Signed-in: Dashboard.

**States:** signed-out header; signed-in header (Dashboard). Hero CTAs still point at `/signup` even when signed in.

**Desktop:** two-column hero; 5-column steps; two-column after-submit.  
**Mobile:** stacked hero; hamburger nav; stacked sections.

**Components:** marketing navbar, primary/secondary pills, numbered step list, mock agent studio, mock review cards, footer.

**Data shown:** static marketing copy only. No live metrics.

**Must NOT invent:** pricing, testimonials, social proof counts, extra integrations.

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 02 — Sign in

**Route:** `/login`  
**Audience:** Unauthenticated coach. Signed-in users are redirected to `/dashboard`.  
**Purpose:** Email/password sign in.

**Main content:** Eyebrow “Coach access”. Title “Sign in to your workspace”. Note that client onboarding lives at `/f/[slug]`. `LoginForm` default mode signin.

**Primary:** Sign in.  
**Secondary:** in-form tab “Create account” (does not navigate; same page). No “forgot password” UI.

**States:** empty; validation (email required, password min 8); loading “Working…”; error `result.error.message` or “Could not authenticate.” Success → `/dashboard`. `callbackURL` `/dashboard`. Query `?next=` from proxy is **not** consumed.

**Desktop:** two columns (copy | form).  
**Mobile:** stacked, vertically centered.

**Stitch priority:** High. Pair with signup as Auth variants.

---

## SCREEN 03 — Create account

**Route:** `/signup`  
**Audience:** Unauthenticated coach.  
**Purpose:** Create account then coach setup.

**Main content:** Title “Create your workspace”. Same `LoginForm` with `initialMode="signup"`: extra “Your name”, email, password.

**Primary:** Create account → `/onboarding`.  
**Secondary:** Sign in tab on the form.

**States:** same loading/error as login. Name can be empty (falls back to email).

**Layout:** same two-column / stack as login.

**Must NOT invent:** OAuth buttons, email-verify screen (none in UI).

**Stitch priority:** High (variant of Auth, not a unique chrome).

---

## SCREEN 04 — Coach setup

**Route:** `/onboarding`  
**Audience:** Authenticated coach without workspace/profile. If already complete → `/dashboard`.  
**Purpose:** Create workspace from coaching profile.

**Main content:** Eyebrow “Coach setup”. Title “Tell me about your coaching”. `CoachingProfileForm` mode `setup`.

**Fields that exist:**
- Business name
- Coach name
- Coaching type checkboxes: Online, Hybrid, In-person, Nutrition, Other
- Who do you primarily help? (textarea)
- Nutrition coaching? Yes/No select
- Health / injury screening? Yes/No select (default Yes)
- Coaching philosophy (optional)
- Programming considerations (optional)

**Not in this form (exist elsewhere or in DB only):** typical goals, experience levels, brand color.

**Primary:** Create workspace (loading “Saving…”). Server action then leaves the page (redirect via setup action).

**States:** default; validation errors as inline warn text; saving.

**Desktop/mobile:** single column `max-w-xl` form. No AppShell (no product nav yet).

**Copy inconsistency:** page still says “Client onboarding stays on the public home page” — live clients use `/f/[slug]`.

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 05 — Dashboard

**Route:** `/dashboard`  
**Audience:** Authenticated coach with workspace.  
**Purpose:** Welcome + shortcuts. **No live activity feed, no counts.**

**Main content:**
- Welcome, `{coachName}`; email; workspace name.
- Card: Coaching profile snippet (target client, types, nutrition yes/no, health screening yes/no). Not a link.
- Card: Foundation status — Account connected; Workspace owner; Client onboarding at `/f/[slug]`; Clients: workspace database.
- Three tiles: Forms (`/forms`); Clients (`/clients`); **Needs Review** dashed card “Coming in a later phase. No invented counts.” — not a link.

**Primary:** Forms, Clients.  
**Secondary:** AppShell nav.

**States:** always populated after setup. No empty dashboard. No recent forms/clients.

**Desktop:** 2-column profile cards, then 3-column tiles (`sm:grid-cols-3`).  
**Mobile:** stack.

**Must NOT invent:** charts, unread review counts, recent submissions.

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 06 — Forms list

**Route:** `/forms`  
**Audience:** Authenticated coach.

**Populated:** vertical cards linking to `/forms/{id}/build`. Name; mono status (`draft` | `published`); “Published: V{n}” or “Not published yet”; updated date. Archived forms are **excluded** from the list.

**Empty:** large card “Create your first onboarding” + Create onboarding.

**Primary:** Create onboarding → `/forms/new`.  
**Secondary:** open builder.

**No:** menus, duplicate, archive from list, search, tabs.

**Desktop/mobile:** same stacked list. Header wraps Create button.

**Stitch priority:** High. Desktop + Mobile (shared list, distinct header wrap).

---

## SCREEN 07 — Create form

**Route:** `/forms/new` (full page, not a modal).  
**Audience:** Authenticated coach.

**UI:**
- Form name (required).
- Start from radios:
  1. **Create with AI** (recommended, accent border): creates **blank** draft, then `/forms/{id}/build?agent=1`.
  2. **Start manually**: blank Welcome / About you / Final check; builder without agent query.
  3. **Start from current onboarding**: deep copy of V1 schema; builder without agent query.
- Submit: “Create and open Agent” vs “Create onboarding”; pending “Creating…”.
- Error banner.

**Must NOT invent:** template gallery, extra AI options at create time.

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 08 — Form builder (highest priority)

**Route:** `/forms/[formId]/build`  
**Audience:** Authenticated coach.  
**Purpose:** Agent + visual draft editor. Autosave. Publish. Human Apply for Agent ops.

### Top-level shell

**Desktop (`lg+`):** two columns — Agent (~18–26rem) | Editor. **Desktop builder does not show live preview column.** Preview is a header link to `/forms/{id}/preview`.

**Mobile (`lg:hidden`):** pill tabs **Agent | Editor | Preview**. Only one pane visible. Preview pane uses `FormPreview` inline.

**Header (inside editor pane):**
- Editable form name (blur saves rename).
- Draft revision `r{n}`; Published V{n} or Not published; if published, “Live URL unchanged until you publish these edits.”
- Save pill: Saved / Saving… / Unsaved changes / Conflict.
- Links: Preview, Responses (`/forms/{id}/submissions`).
- Publish button (no confirmation modal).
- Client link banner: if published, path `/f/{slug}` + Copy client link; else “Publish to give clients a live link…”.
- Alert line for save/publish errors; conflict copy: reload latest version.

**No breadcrumbs.** AppShell sits above.

### Agent panel (`AgentPanel`)

- Title “Build with conversation”.
- Empty: “Tell me how you coach.” Example chips: Build my onboarding; Make this shorter; Add nutrition questions; Review this form; Make this suitable for hybrid coaching.
- Thread: You / Agent labels; whitespace-pre-wrap.
- Proposed changes card when `changeSetId` present: summary; **Apply changes**; **Reject**; View details (operation detail lines).
- ChangeSet status: proposed | applied | rejected | superseded (“This form changed after the Agent created this proposal…”).
- Pending: “Thinking…”.
- Error banner + Dismiss (form unchanged copy).
- Composer textarea + Send (Phosphor paper plane).
- After Apply: editor updates; mobile pane switches to Editor.

### Form editor

**Left structure tree:** Form settings; each section (select, move up/down, delete section, add question); Add section.

**Form settings (selection = form):** title, description, intro title, intro text, success title, success message; Client identity selects (name, email, optional phone); Review rules editor; Versions list (or “Nothing published yet”); public path `/f/{slug}`; Archive (warn text, no modal) → returns to `/forms`.

**Section inspector:** title, nav label, description; add question.

**Field inspector:** question, helper, placeholder (if type supports), required checkbox, type select (all 12 types), choices textarea for selects, Show when (always / all / any + field/operator/value), Move up/down, Duplicate, Delete question (no modal), Advanced → answer key with `window.confirm`.

**Review rules:** add rule, label, all/any conditions, source fields, delete rule. Copy: flag when answer needs coach review. Default new label “Coach review needed”.

### Preview (mobile tab only)

Same `FormPreview` as dedicated preview route.

### Builder states (variants, not separate Stitch pages)

- clean/saved
- saving
- unsaved (700ms debounce)
- conflict (another session)
- Agent empty / conversation / thinking / error
- Agent proposed (Apply/Reject)
- ChangeSet applied / rejected / superseded
- Publish success message vs publish validation error
- published vs draft (live URL copy)
- `?agent=1` autofocus Agent (from Create with AI)

**Must NOT invent:** three-pane desktop if not current — current desktop is Agent+Editor only. Stitch may propose a better layout, but inventory records **today**: no desktop preview pane.

**Stitch priority:** High. Dedicated Desktop + dedicated Mobile.

---

## SCREEN 09 — Form preview

**Route:** `/forms/[formId]/preview`  
**Audience:** Authenticated coach.  
**Purpose:** Walk the draft without saving answers.

**Toolbar:** Back to editor; Mobile / Desktop viewport buttons (default **mobile** framed `max-w-md` rounded device). Preview badge on renderer.

**Submit in preview:** “Finish preview”; success “Preview complete. This was a preview. No answers were saved.”

**404** if form missing (`notFound()`). No global not-found.tsx.

**Stitch priority:** High as a chrome around the public renderer. One desktop master with mobile-frame variant is enough if public form is designed separately.

---

## SCREEN 10 — Public client onboarding

**Route:** `/f/[slug]`  
**Audience:** Public coaching client. Not behind login.

**Renderer:** `OnboardingRenderer` mode `public`. Branding: business name, coach name, optional `primaryColor` hex if valid `#RRGGBB` (not editable in profile UI today). Draft answers persist in `localStorage` key `onboarding_draft:{formId}:{formVersionId}`.

**Steps:** 0 = intro; 1..N = sections; last section Continue then Submit.

**Intro:** brand, “with {coachName}”, title, description paragraphs, estimated minutes, footnote, Start button = intro.buttonLabel.

**Section:** title, description, visible fields (conditional `show` logic), footer. Field groups; special grid for `group === "macros"`.

**Progress:** desktop left 72px dots; header “{nav} · {step} of {n}”; thin progress bar after intro.

**Nav:** sticky bottom Back / Continue / Submit Onboarding. Submitting…. Safe-area padding.

**Validation:** per-section on Continue; full form on submit; inline field errors; banner “Check the highlighted answers.”

**Submit errors:** `OnboardingSubmitError` message; generic network: answers still here, try again. `canCollect` false throws “This onboarding is not collecting answers yet.”

**Success:** success title/messages/closing/aside; check icon card.

**Hydration:** pulse skeleton until localStorage read.

**Honeypot:** hidden website field.

**Field types implemented in `FieldRenderer`:**
- short_text, phone, number (text/tel/numeric)
- long_text
- email
- date
- single_select (`ChoiceList`)
- multi_select (`MultiChoice`)
- boolean (Yes/No ChoiceList)
- scale
- acknowledgement (`CheckRow` + statement)
- unit_number (`UnitNumberField`)

Stitch does not need 12 unique pages. Need **control-family examples** on public form (text, textarea, choice chips, yes/no, scale, checkbox statement, unit+select).

**Must NOT invent:** account creation for clients, payments.

**Stitch priority:** High. Desktop + Mobile (mobile especially: sticky bar, keyboard, progress).

---

## SCREEN 11 — Form unavailable

**Route:** `/f/[slug]` when unpublished, missing, or schema parse fail.  
**Purpose:** Honest dead link. Title “This form is unavailable.”

**Stitch priority:** Medium. Can be a variant of public form, not a third marketing page.

---

## SCREEN 12 — Form responses

**Route:** `/forms/[formId]/submissions`  
**Audience:** Authenticated coach.

**Content:** Back to editor; form name; Responses; Export CSV (`GET /api/forms/{id}/submissions/export`); filter chips All / New / Needs Review / Reviewed; list of client name, version, datetime, status → submission detail.

**Empty:** “No responses yet.”  
**No pagination UI** (server may cap elsewhere; this list is unpaged in the page).

**Stitch priority:** Medium. Desktop + mobile notes (list already stacks).

---

## SCREEN 13 — Clients list

**Route:** `/clients`  
**Query:** `?q=` search (GET form, name or email); `?status=new|needs_review|reviewed`.

**Filters:** All, New, Needs Review, Reviewed. Status = **latest submission**.

**Row:** full name, status label, email, latest form name + date.

**Empty:** “No clients yet” (also used when search/filter matches nothing — same copy).

**Cap:** 50 clients, **no “load more”**.

**Dashboard “Needs Review” tile does not deep-link here.**

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 14 — Client detail

**Route:** `/clients/[clientId]`  
**404** if missing.

**Content:** All clients link; full name; email; phone if present; Export data (`GET /api/clients/{id}` JSON); Delete client data (modal); notice that export filename omits email; external Sheets/webhook copies not deleted.

**History:** onboarding list — form name, version, submitted time, review status → submission route. Empty: “No submissions yet.”

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 15 — Submission detail (highest priority)

**Route:** `/clients/[clientId]/submissions/[submissionId]`  
**Layout:** `max-w-3xl` single column (desktop is not a wide dashboard).

**Header:** Back to {name}; Client; form · version · datetime; status badge (Needs Review uses warn pill; else New/Reviewed).

**Actions:** Mark reviewed (hidden if already reviewed). No loading/error UI on that button.

**Snapshot:** up to a grid of summary tiles (`submissionSnapshot`) if schema parses.

**Notes:** optional submission.notes aside.

**Submitted Information:** `SubmissionAnswers` by schema sections/fields. Fallback if schema unreadable.

**Coach Review Needed (Review Flags):** distinct section. Empty: “No deterministic review flags…”. Else cards: Review flag, label, “Based on:” source field labels. **Not medical.**

**AI Coach Brief:** distinct section. Auto-POST generate if status pending. States: pending / processing (“Generating brief…”) / complete / failed + Retry. Complete sections (omit empty): Summary, Goals, Training, Nutrition, Lifestyle & Recovery, Coaching Preferences, Things to Review (labeled AI clarification), Kickoff Conversation. Each block: text + “Based on N answers” expand source labels.

**Must keep Review Flags visually distinct from Coach Brief.**

**Stitch priority:** High. Desktop + Mobile.

---

## SCREEN 16 — Settings hub / workspace

**Route:** `/settings`  
**Content:** Workspace name; links Coaching profile, Connections; Export workspace JSON (`GET /api/workspace`); Delete workspace (inline, type DELETE, owner copy). No billing. No workspace rename field.

**Stitch priority:** Medium. Shared responsive.

---

## SCREEN 17 — Coaching profile (edit)

**Route:** `/settings/profile`  
**Same fields as setup**, button “Save profile”, status “Saved”, errors inline.

**No brand color, logo, typical goals, experience levels.**

**Stitch priority:** High. Desktop + Mobile (same form as setup; different chrome = AppShell).

---

## SCREEN 18 — Connections

**Route:** `/settings/connections`  
**Privacy line:** submissions may include health-related information.

### Google Sheets

- OAuth not configured: env instructions (not a connect button).
- Not connected / disabled: Connect Google Sheets → `/api/integrations/google/start`.
- Connected: status Connected; spreadsheet title; paste URL/ID “Use existing”; “Create onboarding spreadsheet”; Open spreadsheet; Test connection; Disconnect.
- Error: Needs attention + Reconnect.

No dedicated “OAuth connecting” screen (browser leaves to Google).

### Webhooks

- Create: name + HTTPS URL + Add webhook.
- Secret shown **once** in aside: HMAC-SHA256 instructions.
- Per webhook: status Connected / Disabled / Needs attention; Send test; Rotate secret; Disable/Enable; Retry all failed.
- Developer header docs in body copy.

### Deliveries

- Empty: no deliveries yet.
- Rows: event type, status Pending / Sending / Sent / Failed, attempts, time, last error, link to submission, Retry if failed/pending.

**Stitch priority:** High. Desktop + Mobile.

---

# Redirects and non-product surfaces

| Surface | Behavior | Stitch? |
| ------- | -------- | ------- |
| `/coach/login` | Redirect `/login` | No |
| `/coach/onboarding` | Redirect `/clients` | No |
| `/dev/*` | Internal sandboxes / V1 harness | No |
| Next `notFound()` | Default Next 404, no custom page | Optional tiny error |
| API JSON 401 | Not a screen | No |

---

# Modals / overlays

| Overlay | Trigger | Purpose | Destructive? | Desktop / mobile |
| ------- | ------- | ------- | ------------ | ---------------- |
| Delete client | Client detail | Type DELETE; cancel / delete | Yes | Centered md; bottom sheet on small (`items-end`) |
| Landing mobile menu | Hamburger | Section + auth links | No | Mobile only |
| `window.confirm` answer key | Field Advanced | Warn key change | Risky | Native browser dialog |
| Webhook secret aside | Create/rotate webhook | Show secret once | No | Inline, not modal |
| Agent Proposed Changes | Agent reply with ChangeSet | Apply / Reject | No | In-panel card |
| Publish | none | Immediate publish | No modal | — |
| Delete field/section | Immediate | No confirm | Yes, no modal | — |
| Archive form | Immediate | No confirm | Yes, no modal | — |
| Disconnect Google | Immediate | No confirm | Reversible | — |
| Workspace delete | Inline type DELETE | Not a modal | Yes | — |

No Radix/shadcn Dialog. No toast. No popover menus. No drawers except landing hamburger.

---

# Empty states

| Empty | Where |
| ----- | ----- |
| No forms | `/forms` |
| No clients | `/clients` (also empty search/filter) |
| No submissions (client) | Client detail |
| No responses | Form submissions |
| No review flags | Submission detail |
| Coach Brief pending/generating | Submission detail (not empty illustration) |
| No Agent messages | Builder Agent empty + chips |
| No deliveries | Connections |
| No published versions | Builder form settings |
| No Sheets connected | Connections Google |
| No webhooks | Connections (form still shown; empty list) |
| Dashboard Needs Review | Placeholder “coming later” |

---

# Error states

| Error | Surface |
| ----- | ------- |
| Auth failed | Login/signup inline |
| Profile validation | Setup / settings profile |
| Create form failed | `/forms/new` banner |
| Draft save failed / conflict | Builder alert |
| Publish validation / failure | Builder message |
| Agent failed | Agent banner (form unchanged) |
| ChangeSet superseded | Proposed card |
| Form 404 | `notFound()` on build/preview/submissions |
| Client/submission 404 | `notFound()` |
| Public form unavailable | `/f/[slug]` dedicated copy |
| Public submit/network | Banner + retry; answers kept |
| Not collecting yet | Submit error |
| Coach Brief failed | Panel + Retry |
| Google not configured / test fail | Connections message |
| Webhook create/test fail | Connections message |
| Delivery failed | Delivery row + retry |
| Delete client/workspace fail | Modal/inline warn |
| Unauthorized APIs | JSON 401, not a page |

---

# Loading / processing states

| Process | UI |
| ------- | -- |
| Auth | “Working…” |
| Profile save | “Saving…” |
| Create form | “Creating…” |
| Draft autosave | “Saving…” |
| Agent | “Thinking…” |
| Publish | no explicit spinner (message after) |
| Public hydrate | pulse skeleton |
| Public submit | “Submitting…” |
| Coach Brief | auto generate; “Generating brief…” |
| Google OAuth | leave site |
| Delivery retry | refresh list |
| Export | browser download, no in-page spinner |
| Delete client/workspace | “Deleting…” |
| Mark reviewed | silent refresh |

---

# Component inventory (current, for design system)

### Navigation
- Marketing sticky header + mobile hamburger (exists)
- Authenticated **top** header wrap (exists) — **no sidebar**
- No app mobile tab bar
- Ad-hoc back links, not a breadcrumb component

### Buttons
- Primary: rounded-full accent, light text
- Secondary: rounded-full border-line
- Tertiary: underline text
- Destructive: often still accent fill + warn text labels (Archive, Delete)
- Icon: Agent send; onboarding carets
- Loading/disabled: opacity 60 / 50

### Form controls (coach + client)
- Text input, textarea, native select, native checkbox, native radio cards
- Client: ChoiceList chips, MultiChoice, Scale, CheckRow, date input, tel/email, unit number + unit select
- No custom toggle component (boolean is Yes/No chips)

### Status
- Form: `draft`, `published` (archived hidden from list)
- Submission: New, Needs Review, Reviewed
- Integration: Connected, Disabled, Needs attention
- Delivery: Pending, Sending, Sent, Failed
- Save: Saved, Saving…, Unsaved, Conflict
- ChangeSet: proposed, applied, rejected, superseded
- Brief: pending, processing, complete, failed

### Cards
- Form list row, client row, submission row, review flag, Coach Brief blocks, integration sections, Agent ChangeSet, landing mocks

### Feedback
- Inline `text-warn` / `bg-warn-soft`
- One real modal (delete client)
- Native confirm (answer key)
- No toast, no skeleton list except public hydrate

### Type
- Display: Outfit
- Body: Geist Sans ~18px
- Mono eyebrows: Geist Mono tracking wide uppercase

---

# User flows (actual)

## Coach activation
Landing → Signup → `/onboarding` profile → Dashboard.

Login → Dashboard (or `/onboarding` if profile missing).

## Form creation
Forms → Create onboarding → AI / manual / V1 copy → Builder (`?agent=1` if AI) → converse → Proposed Changes → Apply → edit → Preview → Publish → copy `/f/{slug}`.

## Client
Open `/f/{slug}` → intro → sections → validate → submit → success. Unavailable if unpublished.

## Coach review
Clients (optional status filter) → Client → Submission → flags + brief → Mark reviewed. Alternate: Form Responses → same submission URL.

## Connection
Settings → Connections → Google OAuth or webhook → secret once → deliveries / retry.

## Sign out
AppShell Sign out → `/login`.

---

# Recommended Stitch screen set

Do not design `/dev/*` or redirect stubs. Do not design a separate page per save/Agent microstate.

## Design system (1)
**DS-01** Color, type, radius, buttons, inputs, status pills, cards, empty, modal, warn banners.

## App chrome (2)
**CH-01** Marketing nav desktop + mobile open.  
**CH-02** Authenticated AppShell header desktop + wrapped mobile (today’s model). Optional: annotate if redesign introduces a sidebar later — **do not document a sidebar as current.**

## Master product screens

| ID | Master | Coverage | Notes |
| -- | ------ | -------- | ----- |
| 01 | Landing — Desktop | High | |
| 02 | Landing — Mobile | High | Hamburger open |
| 03 | Auth — Desktop | High | Variants: Sign in, Create account |
| 04 | Auth — Mobile | High | Same variants |
| 05 | Coach setup — Desktop | High | No AppShell |
| 06 | Coach setup — Mobile | High | |
| 07 | Dashboard — Desktop | High | Include disabled Needs Review tile as-is |
| 08 | Dashboard — Mobile | High | |
| 09 | Forms list — Desktop | High | Empty + populated as variants |
| 10 | Forms list — Mobile | High | |
| 11 | Create form — Desktop | High | Three start-from options |
| 12 | Create form — Mobile | High | |
| 13 | Form builder — Desktop | High | Agent + editor; save/conflict/publish as variants |
| 14 | Form builder — Mobile | High | Agent / Editor / Preview tabs |
| 15 | Form preview chrome | Medium-High | Mobile/desktop viewport toggle; reuse public form art |
| 16 | Public onboarding — Desktop | High | Intro + a section + success as variants |
| 17 | Public onboarding — Mobile | High | Sticky bar, progress, errors |
| 18 | Public unavailable | Medium | Shared or small variant of 16 |
| 19 | Clients list | High | Empty + populated; desktop/mobile notes on one artboard if list is identical, else two |
| 20 | Client detail | High | + delete modal |
| 21 | Submission detail — Desktop | High | Flags vs Brief distinct |
| 22 | Submission detail — Mobile | High | |
| 23 | Form responses | Medium | Can share clients-list language |
| 24 | Settings hub | Medium | Export + delete workspace |
| 25 | Coaching profile (AppShell) | High | Edit/saved/error variants |
| 26 | Connections — Desktop | High | Sheets + webhook + deliveries |
| 27 | Connections — Mobile | High | |
| 28 | Public field control sheet | Medium | All control families, not 12 pages |
| 29 | Agent ChangeSet + Agent empty | Component | Can live as builder annotations |

---

# Counts for Stitch planning

| Bucket | Count |
| ------ | ----- |
| User-facing product routes | 18 unique URLs (unavailable shares `/f/[slug]`) |
| Recommended Stitch masters (table above) | **29** including DS/chrome/component |
| Full desktop+mobile pairs | Landing, Auth, Setup, Dashboard, Forms list, Create, Builder, Public form, Submission, Connections (**10 pairs = 20**) |
| Shared / single artboards | Preview chrome, unavailable, clients list (if stacked), client detail, form responses, settings hub, profile-in-shell, field sheet, ChangeSet |
| Highest priority | Builder, Public onboarding, Submission detail, Connections, Landing, Auth, Create form, Clients |

If Clients list / Client detail / Profile need explicit mobile artboards because wrapping is poor, add 3 mobile frames (masters 32). Prefer pairing only where layout actually changes (builder, public form, landing, submission).

---

# Current UI inconsistencies (for redesign, not to preserve blindly)

1. **Desktop builder has no preview column**; mobile builder has a Preview tab. Desktop preview is a separate route.
2. App chrome is a **wrapping header**, not a sidebar; landing uses a different nav.
3. Dashboard **Needs Review** is a non-functional placeholder; Clients already has a Needs Review filter.
4. `/login?next=` is set by proxy and **ignored**.
5. Landing signed-in still hero-CTAs to `/signup`.
6. Coach setup copy still says onboarding is on the public home page.
7. Login and signup are duplicate pages wrapping one form with mode tabs.
8. Destructive archive/delete field/section/Google disconnect have **no confirm**; client/workspace delete require typing DELETE.
9. Profile cannot edit `primaryColor` though public forms can consume it.
10. Forms list shows raw status strings (`draft` / `published`); clients use pretty labels.
11. No toast; errors are local banners.
12. Clients empty copy is the same for “none ever” and “no search hits”.
13. List pages cap at 50 with no pagination UI.
14. Settings lists Connections twice (hub link + AppShell item).

---

# Stitch prompt preparation (not the prompts yet)

Each master above has enough fact for a later prompt: route, audience, real fields, real states, real actions, what not to invent. Next step after this file: design system → app shell → desktop masters → mobile masters → state variants on those masters.

Do not generate Stitch prompts in this document.
