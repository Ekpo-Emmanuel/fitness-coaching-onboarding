# Coaching — Canonical Design Specification

Version: 1.1 · September 2026 · Light appearance

This document describes the redesigned Coaching interface implemented in this repository. It is the visual source of truth for new screens, prototypes, and production components. It is framework-agnostic: token names describe intent, not generated CSS classes. The shared implementation lives in `app/globals.css`, `app/design-system.css`, and the reusable product components. The local `/dev/design` gallery uses the same components with explicitly labeled sample data and is unavailable in production.

## Product philosophy and visual direction

Coaching is an AI-first client onboarding workspace for fitness coaches. Its job is to help coaches ask thoughtful questions and understand the person before coaching begins. The interface must feel calm, capable, considered, and personal. It must not resemble a workout tracker, sales CRM, medical dashboard, or generic AI chat application.

The visual direction is a warm editorial workspace: almost-white paper, white working surfaces, a pale sage navigation rail, forest-green actions, fine structural borders, and generous but purposeful space. Display typography provides character; compact sans-serif body text makes the working interface efficient. The landing and authentication screens use a restrained italic serif accent for human-centered phrases. The application uses no decorative gradients, glass panels, stock fitness photography, or ornamental charts.

The hierarchy is task first, context second, configuration third. A page should answer: where am I, what needs my attention, and what can I do next? Prefer one clear action, a readable work area, and adjacent context over a wall of equally weighted cards.

Supported product journey:

1. Sign up and complete a coaching profile.
2. Create an onboarding manually, with the Agent, or from the existing onboarding.
3. Ask the Agent; inspect Proposed Changes; Apply or Reject.
4. Refine questions, sections, conditional logic, client identity, and Review Rules.
5. Preview the client experience and publish.
6. Review original client responses, deterministic Review Flags, and an AI Coach Brief.
7. Optionally send new submissions to Google Sheets or signed webhooks.

Do not add workout programming, meal plans, macro prescriptions, wearables, payments, billing, booking, messaging, leads, sales pipelines, team management, or invented analytics. Do not add integrations beyond Google Sheets and signed webhooks.

## Brand personality and mark

Coaching sounds like a prepared, thoughtful colleague. It is warm without being chatty, precise without being clinical, and confident without exaggeration. The coach remains responsible for decisions; AI is a collaborator.

The wordmark is lowercase `coaching.` in Outfit, weight 600, with slightly tight tracking. The mark is an open circular C with a right-facing arrow inside it, representing a considered next step. It uses the forest-green primary token. Use the existing Brand asset/component; do not substitute a dumbbell, lightning bolt, shield, brain, or generic sparkle logo.

- Standard wordmark: 28px type, 30px mark, 9px gap. Compact rail: 25px type.
- Standalone mark: 24–32px. App icon: white mark on forest green, 10px corner radius in a 40px square.
- Keep at least 8px clear space around the mark. Never stretch, rotate, outline the wordmark, or apply a gradient.
- Use the full wordmark in landing navigation, authentication, setup, and desktop sidebar. Use the compact mark in the illustrative product preview.
- Public onboarding leads with the coach/business name. Coaching attribution is secondary. Never invent a coach logo or unsupported branding control.

## Design Tokens

The following portable token map is authoritative. HEX values are sRGB. Sizes are CSS pixels unless otherwise stated. `rem` implementations may use a 16px root; do not reduce the root size to compress the interface.

```text
color.background.page             = #F7F8F4
color.background.surface          = #FFFFFF
color.background.navigation       = #EEF1E9
color.background.subtle           = #F1F3ED
color.background.hover            = #F3F6EF
color.background.hero            = #E8EFDF
color.background.auth            = #E7EDDF
color.background.agent           = #EEF2E9
color.background.brief           = #EEF3E9
color.background.onboardingRail  = #EAF0E3
color.text.primary                = #243B32
color.text.secondary              = #66716A
color.text.inverse                = #FFFFFF
color.text.onSage                 = #55664E
color.border.default              = #DCE2D9
color.border.control              = #A9B5AA
color.border.selected             = #285B45
color.border.ai                   = #CCD9C6
color.border.warning              = #E6D4B4
color.primary.default             = #285B45
color.primary.hover               = #1E4936
color.primary.soft                = #E8EFE6
color.navigation.selected         = #DCE7D8
color.navigation.hover            = #E4EAE0
color.status.neutral              = #59655E
color.status.neutralBackground    = #EDF0EA
color.status.information          = #3F6570
color.status.informationBackground = #E8EFF0
color.status.success              = #285B45
color.status.successBackground   = #E8EFE6
color.status.warning              = #895820
color.status.warningBackground   = #FBF2E3
color.status.warningRule          = #AE792F
color.status.danger               = #A13C36
color.status.dangerHover          = #862E29
color.status.dangerBackground     = #FBEDEB
color.background.dangerSurface   = #FFF9F7
color.border.danger               = #E2BFBA
color.overlay                    = #243B3266
color.skeleton                   = #E7EBE2
color.avatar.background          = #DBE5D7
color.avatar.border              = #C8D4C5

font.family.body                 = Geist, system-ui, sans-serif
font.family.display              = Outfit, system-ui, sans-serif
font.family.editorial            = Georgia, serif
font.family.mono                 = Geist Mono, monospace
font.weight.regular              = 400
font.weight.medium               = 500
font.weight.semibold             = 600
font.size.micro                  = 11px
font.size.caption                = 12px
font.size.small                  = 13px
font.size.action                 = 14px
font.size.body                   = 15px
font.size.input                  = 16px
font.size.subheading             = 20px
font.size.section                = 22px
font.size.panel                  = 26px
font.size.page                   = 36px
font.size.pageMobile             = 30px
font.size.publicHeading          = 40px
font.size.publicHeadingMobile    = 34px
font.size.marketingSection       = 44px
font.size.marketingHeroMaximum   = 72px
font.size.marketingHeroMobile    = 49px

spacing.0                        = 0px
spacing.1                        = 4px
spacing.2                        = 8px
spacing.3                        = 12px
spacing.4                        = 16px
spacing.5                        = 20px
spacing.6                        = 24px
spacing.7                        = 28px
spacing.8                        = 32px
spacing.10                       = 40px
spacing.11                       = 44px
spacing.12                       = 48px
spacing.14                       = 56px
spacing.16                       = 64px
spacing.18                       = 72px
spacing.24                       = 96px

radius.control                   = 8px
radius.choice                    = 8px
radius.badge                     = 5px
radius.avatar                    = 10px
radius.list                      = 12px
radius.card                      = 14px
radius.preview                   = 16px
radius.modal                     = 20px
radius.circle                    = 50%
border.width.default             = 1px
border.width.semanticRule        = 3px
focus.width                      = 2px
focus.offset                     = 3px
shadow.none                      = none
shadow.selectedTab               = 0 1px 3px #243B320D
shadow.marketingPreview          = 0 24px 60px #243B320E
shadow.modal                     = 0 20px 60px #243B3226

size.control.minimum             = 44px
size.control.public              = 48px
size.action.public               = 52px
size.textarea.publicMin          = 96px
size.textarea.publicMax          = 320px
size.progress.public             = 4px
width.content.publicShell        = 1080px
spacing.public.railGap           = 80px
breakpoint.public.mediumContainer = 680px
breakpoint.public.railContainer   = 1000px
size.icon.navigation             = 21px
size.icon.action                 = 18px
size.sidebar                     = 232px
size.sidebarCompact              = 192px
size.topbar                      = 72px
size.topbarMobile                = 60px
size.mobileNavItem               = 54px
width.content.application        = 1280px
width.content.marketing          = 1440px
width.content.marketingSection   = 1312px
width.content.setup              = 1120px
width.content.profile            = 720px
width.content.publicQuestions    = 600px
width.content.modal              = 520px
width.content.phonePreview       = 390px
width.content.desktopPreview     = 1160px
width.builder.agent              = 380px
width.builder.agentWide          = 420px
width.builder.overview           = 860px
width.builder.inspector          = 740px
width.builder.proposalPreview    = 1160px
size.control.builder             = 46px
size.builder.mode               = 52px
size.builder.questionRow         = 76px
size.builder.composerMin         = 56px
size.builder.composerFieldMax    = 120px
size.builder.composerSend        = 44px
radius.builder.composerDock    = 16px
radius.builder.section          = 12px
radius.builder.proposal         = 10px
color.background.agentMessage   = #E1E9DC
color.background.addQuestion    = #FAFBF8
width.public.rail                = 240px

breakpoint.mobile                = 0–767px
breakpoint.tablet                = 768–1199px
breakpoint.desktop               = 1200–1799px
breakpoint.builder.controls      = 680px
breakpoint.builder.split         = 1100px
breakpoint.builder.wide          = 1500px
breakpoint.previewContainer      = 700px
layer.content                    = 0
layer.publicActions              = 2
layer.navigation                 = 30
layer.modal                      = native dialog top layer
layer.skipLink                   = 60
motion.feedback                  = 150ms ease
motion.skeleton                  = 1500ms ease-in-out, opacity 1 to .45
opacity.disabled                 = 0.5
```

The only decorative color accent is forest green. Amber, muted blue-gray, and red communicate specific states. They are not alternative brand palettes. Custom coach colors may affect public branding only; maintain legible controls and never recolor Review Flags or destructive actions.

## Typography

Use Geist for body text, metadata, inputs, actions, tabs, and navigation. Body is 15px/1.6 at weight 400. Supporting copy is 13–14px/1.65; captions 12px/1.5. Inputs remain 16px on all devices to preserve mobile legibility and avoid browser zoom.

Use Outfit for page titles and section headings. Page titles are 36px/1.15, weight 500, tracking -1.1px on desktop; 30px/1.15, tracking -0.8px on mobile. Section headings are 22px/1.3, weight 500, tracking -0.45px. Small panel headings are 20–26px. Avoid bold-heavy interfaces.

Landing hero scales from 48px to a 72px maximum at line-height 1.08 and -2.8px tracking. Mobile hero is 49px with -2px tracking. Landing sections use 44px/1.12; mobile sections 34px. Authentication uses a large 40–66px narrative title and a separate 36px form title; mobile form titles are 32px.

Georgia italic is limited to short editorial phrases on landing and authentication, such as “Then coach.” It never styles controls, data, AI output, or review flags. Geist Mono is limited to ordered step numerals and genuinely technical values. Do not set normal UI labels in monospaced uppercase.

Eyebrows are 11px/1.5, weight 600, uppercase, 1.5px tracking, secondary text. They label a region; they are not a second title. Prefer sentence case everywhere else. Keep prose within 45–65 characters where practical. Headings balance lines. Do not force single orphan words.

## Spacing, surfaces, borders, and elevation

Use the 4px spacing scale. Standard desktop page padding is 44px top, 40px sides, 72px bottom. Tablet sides are 28px. Mobile padding is 28px top, 20px sides, and 36px bottom, in addition to navigation clearance. A page header is followed by 36px desktop / 28px mobile space.

Use 24–32px gaps between major regions, 16–24px between fields, 8px between label and input, and 4–8px between related metadata. Working panels have 24–28px internal padding; mobile uses 20–24px. Dense rows have 21px vertical / 24px horizontal padding; mobile 18px / 16px.

Surface hierarchy:

1. Paper page: continuous workspace background.
2. White working surface: forms, original answers, grouped lists, connection configuration.
3. Sage context: navigation, Agent, brief, introductory panels.
4. Semantic surface: amber flag or warning; pale red destructive area.
5. Modal: white, elevated, dimmed surroundings.

Use 1px borders to separate surfaces and rows. Control borders use the stronger control token. A 3px leading rule identifies proposals, AI briefs, and Review Flags. Never rely on the rule color alone; include explicit labels. Ordinary panels do not cast shadows. Only floating modals, selected tabs, and the marketing product illustration use the listed shadows.

Lists are one shared white surface with separators, not individually floating cards. Plain settings content and explanatory text need no extra container. Rounded corners follow component scale; do not make every object a pill.

## Navigation and page headers

Desktop navigation is a fixed 232px sage sidebar. Order: Dashboard, Forms, Clients, Connections, Settings. Each item combines a 21px Phosphor icon and a label. Active navigation uses a pale-green filled rectangle, stronger green text, medium/semibold weight, and `aria-current="page"`. The business/workspace identity sits above navigation. A coaching profile shortcut and sign out sit at the bottom. Connections is a primary destination even though its URL is under settings.

The 72px topbar shows the current area, a quiet product note, and a workspace initial linking to the coaching profile. Do not introduce global search, notifications, team switchers, or billing controls without real product support.

On mobile, replace the sidebar with a fixed bottom navigation containing all five destinations, icon above label. Each item is at least 54px high. Add bottom safe-area padding. Reserve at least 74px plus safe area in page content. The topbar becomes 60px. Public onboarding and authentication never show this workspace navigation.

Page headers contain an optional eyebrow, one H1, one short description, and a right-aligned action group. One filled action is preferred. On mobile the action group moves beneath the title and stretches to available width. Back links sit above the header. Never crowd actions into the title line on small screens.

## Buttons and controls

Primary buttons: forest-green fill, white text, 1px green border, 8px radius, 14px/500 type, 10px by 18px padding, minimum 44px height. Hover uses the darker green token. Use one primary action per decision region.

Secondary buttons: white fill, ink text, neutral border; hover uses navigation background and stronger border. Tertiary actions are text links with visible underline or low-emphasis buttons. Icon-only actions require an accessible name and at least a 44px hit area. Icons normally measure 18px. Do not invent meaning through an unlabeled icon.

Destructive buttons: red fill with white text, darker red hover. Keep them away from the normal primary action. Disabled actions use 50% opacity and cannot be activated. Pending actions retain their width and replace their label with a specific verb: “Saving…”, “Publishing…”, “Submitting…”, or “Deleting…”. Prevent duplicate activation.

Text fields and textareas use white fill, ink text, a 1px control border, and 8px radius. Single-line controls are at least 44px; public controls at least 48px. Textarea minimum height is 104px and may resize vertically. Labels sit above controls. Placeholder text supplies an example, never the only label. State whether a field is optional. Show errors near the field and retain entered values.

Use native selects when choosing from a short, stable configuration list. They match input height and typography. Use visible checkboxes/radios for settings and mutually exclusive creation choices. Native marks are 18px; their label provides the larger touch target. Selected creation choices have a sage fill, green border, and 3px leading rule. Only the selected choice gets this treatment.

Filter tabs sit in one muted rounded track. The active tab has a white surface and small shadow. Filters retain the search query; search retains the active status. Empty search results explain the filter mismatch and offer “Clear filters”, not a first-use onboarding message.

## Client-facing onboarding controls

Present a short group of questions at a time within the schema section. Keep related questions together; do not force one question per page. A question group contains its label/legend, optional hint, control, and inline error. Conditional questions appear directly after the triggering question and do not occupy space while hidden.

- Short text/email/phone: full-width labeled input with appropriate keyboard and autocomplete.
- Long text: full-width textarea; allow comfortable multiline answers.
- Single choice and yes/no: large selectable rows, 48px minimum. Selected choice has sage fill, green border, and an exposed pressed/selected state. Yes/no may form two columns when space permits.
- Multi-select: wrapping selectable choices with visible selected state and checkmarks. Labels must wrap without truncation. Do not require precision taps on a tiny checkbox.
- Scale: evenly spaced numbered choices that wrap into usable rows when necessary. Each target remains at least 44px. Keep both endpoint meanings visible.
- Date: native date control with a persistent label.
- Number and unit: number entry and unit selection remain visually grouped; on narrow screens wrap without separating the unit meaning from the value.
- Acknowledgement: entire statement row is selectable; a visible checkmark confirms selection. Do not preselect it.
- Validation: show the reason and correction, expose invalid state, focus the first invalid control where available, and preserve all other answers.

Back never submits. Continue validates the current question page. The final question page replaces Continue with Submit onboarding. During submission, disable repeat submission and back navigation. Failed submission preserves responses and displays a retryable message. Success replaces the form with a concise receipt; preview success explicitly says that no answers were submitted.

## Public Client Onboarding

### UX philosophy

The public route /f/[slug] is a guided conversation, designed first for a 390px phone. Use Coaching’s paper, forest, sage, Outfit headings, and Geist body text. Keep personal questions readable and actions predictable. No coach navigation, AI terminology, decorative dashboard cards, or new product features. Preserve the published schema and its order; pacing is a presentation layer, never a schema migration.

### Mobile layout and exact dimensions

Use a full-height paper canvas with 20px horizontal padding; below 360px use 16px. Business identity occupies a 92px header (80px below 360px), with a 36px square initial mark, 10px radius, white fill, and a thin border. The initial is a text fallback, not a custom logo. Show the configured coach name below business name when present. Preview gets a small outlined Preview label.

The question column is at most 600px, centered. Start content 28px below the header, or 24px below 360px. Mobile h1 is Outfit 34px/1.12, weight 500, tracking -0.035em; below 360px use 30px. Labels are Geist 16px/1.5, weight 500; input text stays 16px to avoid mobile browser zoom. Question spacing is 28px. Use 12px for quiet progress/helper metadata and 13px/1.65 for notes. Do not shrink controls to fit more questions.

### Desktop and preview adaptation

Use container width, not the outer browser width, to choose layout; builder previews must retain their mobile composition. At 680px available container width, h1 becomes 40px, top spacing 48px, schema two-column choices may use two columns, and the primary action becomes content-sized with a 200px minimum aligned right. Below that width, the primary action fills remaining width beside Back.

At 1000px available container width (approximately 1040px viewport with page padding), show a 240px orientation rail, an 80px gap, and the 600px question column within a 1080px maximum layout. The rail stays on paper, has a short heading, numbered schema sections, current/completed indicators, and a brief Back reassurance. It is sticky at 40px from the top, not an interactive navigation menu. Keep the rail absent at 320, 390, and 768px; show it at 1280 and 1440px. Never stretch inputs into the extra desktop space.

### Welcome and progress

Welcome uses a quiet eyebrow, the published intro title and paragraphs, actual estimated time when supplied, and a short explanation that answers are sent to the coach when finished. Preserve author-written intro copy; do not manufacture a time estimate. Time and purpose share a thinly bordered two-column band. The schema supplies the start button label.

After Start, show the section name, “Section n of m”, and a 4px progress track. Within a split section, show “Part n of m” above the heading. Progress counts preceding visible question pages divided by the total visible pages. It remains below 100% until successful submission; it is orientation, not a promise of remaining time. Conditional-only pages may change the denominator. Provide progressbar semantics and section information in its accessible value text. Do not list every future question on mobile.

### Question pacing

Build stable pages from each section in schema order. Consecutive explicit schema groups remain together. A conditional field immediately following a block containing its trigger joins that block. Pack blocks using a four-point budget: ordinary controls cost one; long text, multi-select, and single-select with more than four options cost two. Conditional follow-ups add no extra pacing cost, so the client sees them beside the triggering context. An explicit group may exceed the budget rather than being split arbitrarily. This gives short groups, with two richer questions or up to four compact controls in the common case. The baseline form has fewer than 30 pages, not one screen per answer.

Filter visibility with the existing deterministic engine. Skip pages containing no visible fields. Keep page identifiers tied to section and first field IDs, not answer-dependent indices. Never auto-advance after selection. Retain hidden answers in memory and draft so toggling a trigger does not erase work; submission validation continues to ignore hidden fields as defined by the existing engine.

### Field and control behavior

Use a legend, optional schema description, control, then associated inline error. Required fields have a muted asterisk and a page-level explanation; optional fields explicitly say Optional. Acknowledgements also show their question label and requirement. Never infer medical urgency from a field name.

- Text, email, phone, date, number: labeled white inputs, 48px minimum height, 8px radius. Use email/tel/native date controls, available autocomplete, and numeric or decimal keyboards as appropriate. Placeholders are examples, never labels.
- Long text: three initial rows, 96px minimum, grows with content where supported, capped at 320px with scrolling and manual vertical resize. No giant blank response panel.
- Single choice and boolean: bordered full-width rows or compact equal-width choices. Selected state uses sage fill, forest border, an inset stroke, checkmark, and aria-pressed. Labels wrap. Booleans start unanswered; No is an explicit valid answer.
- Multi-select: wrapping pills, minimum 48px height, with checkmarks and exposed pressed state. Press again to remove a selection.
- Scale: render the schema’s inclusive integer min/max range, not a hardcoded five-point scale. Auto-fit columns with 44px minimum width and 48px height, wrapping when needed. Show numbered endpoint meanings below.
- Units: keep selectors beside each other with wrapping, above the numeric input(s). Label values with the field and unit; paired feet/inches remain in two equal columns.
- Acknowledgement: native checkbox inside a selectable bordered statement label, 20px visible checkbox and generous row target. Space toggles it. Never preselect.

Optional blank selects, scales, numbers, units, and booleans do not block Continue. Required numeric blanks must not silently become zero. Use the shared validation engine for both page and final validation.

### Navigation and mobile keyboards

Back and the primary action sit in a sticky bottom row within the question column. Use a paper fill, 1px top border, 12px action gap, 52px button height, and bottom padding max(16px, safe-area-inset-bottom). The row remains in document flow, so it reserves its own space. Controls use 32px top and 120px bottom scroll margins. When visualViewport shrinks by more than 140px while focus is within the form, switch the row to static positioning so it does not sit above the keyboard and obscure answers. On mobile, Back stays compact and Continue fills the remainder. At desktop widths, keep Back left and the primary action right.

Back never validates or submits. Continue validates the current page through the existing section validator. Successful transitions focus the new heading without opening a keyboard. No automatic field focus on initial load. Scroll instantly on deliberate transitions; do not animate a long page pan. Conditional reveals do not move focus or trigger scrolling.

### Validation and respectful sensitive questions

Keep all entered values. Place an error under its control, connect it through describedby, expose invalid state, and announce a concise summary: “Check the highlighted answers before continuing.” Focus the first invalid input or choice within this renderer only; never capture focus in another preview or panel. On final or server validation, return to the page containing the first invalid answer, including unit/companion keys.

Use schema wording and descriptions for health context. Conditional details have a subtle 2px neutral left border and 16px inset, not an alarming card. Do not show Review Flags, risk labels, diagnosis, or medical advice. Do not make unsupported privacy claims such as “Only your coach can see this”.

### Autosave and recovery

Save locally under the existing version-specific draft key. Persist {step, pageKey, data}: step remains the original one-based schema section index for compatibility; pageKey restores the exact new question page. Read old {step,data} drafts, validate the cached shape, merge only known answer keys, and clamp invalid section values. Restored flows show a small sage confirmation, “Your saved answers are ready. Pick up where you left off.”

A quiet expandable disclosure below the questions states whether progress is saved on this device. It contains the existing opt-out checkbox and explains shared-device privacy. Turning saving off removes the saved copy without clearing in-memory answers. Storage failures say to keep the page open; never claim autosave worked when it did not. Successful submission clears the local draft. Preview does not claim submission or persist answers when persistence is disabled.

### Submission and success

The final page shows Submit Onboarding (Finish preview in preview mode), without another confirmation dialog. Validate the full published schema, guard immediately against duplicate calls, disable questions and Back, and show “Sending answers…” with a small spinner. Reuse the same submission attempt ID for retry, retaining it in session storage when available and memory otherwise. Preserve the public API contract, form version, identity mapping, canonical Submission, ReviewFlags, and IntegrationDelivery behavior.

On network or server failure, preserve answers and say “We couldn’t send your answers. They’re still here. Please try submitting again.” The same submission action becomes available. Server field errors also return the client to the affected question page. Do not expose technical exception text.

On success, replace the form and rail with a centered 600px receipt: 64px sage check circle, quiet “Onboarding sent” eyebrow, schema success title, and concise confirmation that answers reached the coach and the page may be closed. End with a thinly bordered “Submission received” row. No invented response time, booking, messaging, or promised plan. Preview explicitly says no answers were submitted. Success focus moves to the heading.

### Accessibility, brand contrast, and motion

All controls remain keyboard-operable with a visible 3px forest focus ring and 4px offset. Use fieldsets/legends, programmatic input labels, associated hints/errors, native acknowledgement checkboxes, and semantic progress. Maintain 48px public control height, 44px minimum scale width, wrapping labels, and no horizontal overflow at 320px. Keep text at AA contrast. Accept only six-digit HEX custom brand colors; darken their RGB channels until white button text reaches 4.5:1. This affects only the public accent, not status meanings.

Only the 180ms progress fill transition and submission spinner add motion. The reduced-motion preference disables transitions and animation. Browser keyboard behavior still requires verification on physical iOS and Android devices; automated viewport checks cannot reproduce every keyboard/browser combination.

## Status badges and meanings

Badges are compact rounded rectangles, 5px radius, 11px/500 text, 4px by 9px padding, and a 5px dot. Always include text; dots and colors are secondary cues.

| Status | Treatment | Meaning |
| --- | --- | --- |
| Draft | Neutral | Editable form not currently published as this draft |
| Published | Green | A published version is available to clients |
| New | Blue-gray | A client’s latest submission is new |
| Needs review | Amber | Latest submission needs the coach’s attention |
| Reviewed | Green | Coach explicitly marked it reviewed |
| Connected / Sent | Green | Connection is active / delivery succeeded |
| Not connected / Disabled | Neutral | No active destination |
| Needs attention | Amber | Connection needs repair or reconnection |
| Failed delivery | Red | Delivery failed; the stored submission remains available |
| Pending / Sending | Neutral | Delivery is waiting / in progress |
| Proposed changes | Blue-gray | AI proposal has not been applied |
| Applied | Green | Proposal was applied to the draft, not automatically published |
| Rejected | Neutral | Proposal was dismissed without changing the draft |
| Outdated proposal | Amber | Draft changed; generate a current proposal |

Never interpret Reviewed or a green badge as medical clearance. Never label a person as risky, unhealthy, or diagnosed.

## AI Form Agent

The Agent is a form-building tool, not a generic chatbot. A coach describes a change in ordinary language. The Agent returns a short acknowledgement plus structured operations. Deterministic validation builds an AgentChangeSet. The coach reviews that object and applies or rejects it. AI never mutates or publishes the form.

Philosophy: acknowledge, propose, let the coach decide. For a simple edit, the spoken reply is one sentence. The ChangeSet carries the detail. Do not narrate field types, keys, operation names, or schema internals in coach-facing copy. Do not repeat the request. Do not add unsolicited coaching advice. Ask one clarifying question only when a reasonable proposal would likely be wrong.

### Mobile Agent

At 320–679px the Agent is a full-screen working mode. Compact the heading once a conversation exists so the thread and composer dominate. Starter prompts sit in the empty state as full-width rows; tapping one sends it. The composer is one ivory dock: auto-growing field plus a 44px send stamp inside the same surface, above the workspace mode tabs. Enter inserts a new line. Command/Control + Enter sends. When the visual viewport shrinks for a keyboard, the workspace height follows so Send stays reachable. Bottom tabs remain reserved; do not hide Apply, Reject, or Send behind the keyboard.

### Desktop Agent

From 1100px the Agent is a 380px (420px from 1500px) sage column beside Build. Keep density high: compact heading, short replies, ChangeSets as the primary object. Do not use layouts that only work at full page width. The composer stays at the bottom of the column. Auto-focus the composer at 1100px and wider.

### Conversation hierarchy

Coach requests are labeled “You” with a forest left rule, not a chat bubble. Agent replies are unlabeled product copy in 14px / 1.65. A pending ChangeSet is a white panel with a 3px forest top rule. Applied and rejected ChangeSets shrink into receipts. Errors sit above the composer in amber and say the form has not changed. Working state is one quiet line: “Working on your form…”.

Starter prompts disappear after the first message. After an applied ChangeSet that is still the latest turn, show up to three next-action prompts derived from what just changed. Those prompts still go through propose → review → Apply.

### Proposed ChangeSets

Pending proposals list human verbs and labels parsed from validated detail lines (Add, Remove, Move, Update). Do not show raw JSON or operation type names. A section removal uses an amber top rule and a short destructive note. Preview proposed form remains available and is labeled Proposed · Not applied. Decision order is Reject, then Apply changes. Both stay 44px and stack below 360px. While a decision is in flight, disable both.

Applied receipts say the change is in the draft and that publish is still required. Offer View in Build without auto-switching modes. Rejected receipts confirm the draft did not change. Outdated proposals are amber, disable Apply, and offer an updated request. Historical applied/rejected cards stay in the thread but use quieter padding and type so pending work stays dominant.

### Composer, empty state, and errors

Empty state heading: “Tell me what to change.” Four short starter prompts, contextual to the current form when it already has substance. Placeholder: “Describe the change…”. Restore the request on failure and offer Retry. Do not expose stack traces. Preserve conversation across mode switches and reload from the thread.

Do not keep a permanent “Nothing changes without your approval” line under the composer. Pending ChangeSets already say Not applied. Approval is the Apply action, not composer chrome.

The Agent still flushes unsaved draft edits before propose, preview, and Apply. Revision conflicts supersede the proposal instead of overwriting a newer draft.

## Form Builder Workspace

### Philosophy and architecture

The builder is a focused authoring workspace at `/forms/[formId]/build`. Its hierarchy is a compact workspace toolbar, then the current task. It replaces the normal application sidebar, topbar, and mobile bottom navigation. The visible Forms link provides the exit. Do not put a second application navigation bar around this workspace.

The shell fills the available visual viewport. Use a single toolbar rather than a page hero plus a second mode row. The toolbar is tooling: where I am, which mode I am in, whether the draft is saved, and Publish. Use `100dvh` as the fallback and the visual viewport height when available. Individual work panes scroll; the page must not develop horizontal overflow.

From 680px, the toolbar is one 56px row: Forms exit, truncated form name, a quiet publication chip, a centered Agent / Build / Preview segmented control, save status, and Publish. Truncate only the header name with an ellipsis; editable names and question text remain fully available in their editors. Publication copy stays short: “Draft · Not published”, “Published · Up to date”, or “Published · Unpublished changes”. Do not keep explanatory slogans such as “AI drafts. You decide.” in chrome.

At 320–679px the builder uses a purpose-built phone chrome, not a stacked desktop toolbar. Keep one 48px top bar: back to Forms (arrow, with accessible name), truncated form name, save status, a Form tools overflow, and Publish. Move Agent / Build / Preview to a fixed bottom tab bar with icon and label. The phone does one mode at a time; do not stack mode tabs under the identity row. Hide Review rules and Form settings from persistent Build chrome; they live in Form tools. Hide the “Your onboarding” toolbar row on the overview. All sections remains a contextual back control only while editing. Publication copy stays available to assistive technology. Omit the Build question count on the tab bar. Below 360px, omit the Publish arrow.

The bottom tab bar stays put while the work pane scrolls. Keep it about 56px plus the safe-area inset. Reserve that height so the Agent composer sits above the tabs, not under them. Do not collapse chrome on scroll.

From 680px, the segmented mode control sits in a sage track with a white selected tile. Selection has a programmatic pressed state. Build can show the question count.

### Mobile and desktop composition

At 320–1099px, Agent, Build, and Preview are separate full-width modes. Agent and Build remain mounted so conversation, draft values, and the selected inspector survive switching. Preview uses the real client renderer and starts a fresh trial when it is reopened. Do not imply that preview answers are saved.

At 1100–1499px, Agent and Build appear together: a 380px Agent column, a 1px divider, and the flexible editor. At 1500px and wider, the Agent column becomes 420px. Selecting Preview replaces both panes with a full workspace preview. There is no third always-visible preview column, even on very wide monitors. Agent and Build selections retain the same two-pane composition on desktop.

Use 20px horizontal content padding on mobile, 16px below 360px, and 32px in the editor from 680px. The overview is at most 860px wide; the inspector is at most 740px. Agent padding is 20px mobile and 24px in the split layout. Two-column control groups begin at 680px; narrow screens stack labels and controls. Never reduce input text below 16px to make a panel fit.

### Agent interaction and states

The Agent has a pale sage surface, a compact brand motif, a contextual heading, a flexible scrolling conversation, and a composer fixed within the bottom of its pane. This is a workspace tool, not a popover. The empty view explains that the coach can describe a change and shows four concrete suggestion buttons. Selecting a suggestion sends it as a request; it still requires review and Apply.

Coach lines use a “You” label and a forest rule. Agent replies stay short. Pending ChangeSets are the visual focus. Applied and rejected ChangeSets collapse to receipts. Body text is 14px.

The composer is a single paper dock, not a textarea plus a separate Send button. Warm ivory field (#FFFEFA), 16px radius, 1px sage border that turns forest on focus. 16px / 1.45 type. No manual resize handle. Height grows from one line (40px) to 120px, then the field scrolls. Send is a 44px forest stamp inside the dock, bottom-right, using an up arrow. Empty and busy send states stay in the dock: muted sage when there is nothing to send, forest spinner while the Agent is working. Enter always makes a new line. Sending is the stamp or Command/Control + Enter. Shift+Enter also makes a new line. Do not send on a bare Return.

Starter prompts and the composer are one system. Tapping a prompt sends it. After the first turn, the dock is the primary way to continue.

Working states say what is happening: working on the form, preparing preview, applying, or rejecting. A small 900ms linear spinner may accompany the conversation line and the send stamp; do not fabricate percentages or elapsed-time promises. Disable Send and duplicate clicks while a request is pending. Keep the dock visible and intact. During send, lock the field so the in-flight request cannot be edited. During apply/reject/preview, the coach may type the next request but cannot send it yet. Failures keep the conversation, restore the request for retry, and show persistent explanatory text above the composer. Applying changes temporarily disables manual editing to prevent competing draft mutations.

When the mobile keyboard reduces the visual viewport, the workspace shrinks and the conversation gives up space before the composer. Keep the composer and mode navigation reachable without a competing bottom app bar. The Build pane remains independently scrollable to focused inputs. Include the bottom safe-area inset in composer and dialog actions. Validate this behavior on physical iOS and Android devices before release; desktop viewport emulation does not prove native keyboard behavior.

### Proposed Changes

Keep the canonical pipeline intact: AI produces operations, deterministic validation/simulation creates an AgentChangeSet, the coach reviews it, and only explicit Apply changes changes the draft. Publish is a separate decision.

A pending proposal is a white 12px-radius panel with a 3px forest top rule and 16px padding, reduced to 12px below 360px. It contains an 18px Outfit heading, state badge, and a verb/label list of validated details. Raw operation JSON and answer keys are not primary reading content. Put Preview proposed form before Reject and Apply changes. Apply is the primary action. At 360px and above these decision buttons sit beside each other; below that they stack. Section removals use an amber top rule.

Proposal preview opens a native dialog up to 1160px wide, constrained by 16px viewport margins. Clearly label it “Proposed · Not applied”. Render the actual simulated form with the same public renderer as draft preview. Simulation is read-only and must check workspace, form, proposal status, and base revision. Closing the preview does not apply anything. Keep a visible Close preview action and an explicit Apply changes action in the dialog footer.

Applied proposals become compact receipts explaining that the draft changed and publication is still required. Provide View in Build; do not unexpectedly switch a mobile coach away from the receipt. Rejected proposals confirm that the draft did not change. Outdated proposals use amber and offer a new proposal request; disable Apply instead of overwriting a newer draft. Pending decisions disable both Apply and Reject. Preserve receipts in conversation history.

### Manual editor, sections, and questions

Build starts with the section overview, a short explanation, and Add section. Its toolbar provides Form settings and Review rules. Sections are white 12px-radius disclosures with a 1px border, numbered heading, question count, optional introduction, and Edit section. Start with sections expanded. Questions are divided rows, not nested cards: a small order number, the full label, type/required/conditional metadata, and a trailing arrow. Rows are at least 76px high and wrap long labels. Each section ends with a full-width Add question row.

Selecting a section or question replaces the overview with an inspector. Put All sections before its heading and focus the heading when entering. Do not show the entire configuration tree beside a narrow mobile inspector. Section editing offers title, introduction, and explicit Move up / Move down controls. Disable movement at the first/last boundary.

Add section opens a short name dialog. Add question opens a short dialog with answer type and question text; after creation, open the new inspector. Do not require users to know schema keys. The question editor starts with question text, answer type, and Required, followed by only the controls relevant to that type. Preserve supported types: short text, long text, email, phone, number, single select, multi-select, boolean, scale, date, acknowledgement, and number with unit.

Select options use ordered rows with a visible label input and accessible Remove action. Renaming a choice preserves its stored option value. Add choice appends a new stable value; retain at least one option. Scale controls expose minimum, maximum, and endpoint labels. Number controls expose bounds and whole-number preference. Number-with-unit controls expose the default unit and supported unit configuration. Acknowledgement exposes its statement. Use native selects, checkboxes, and inputs with 46px minimum control height.

Keep helper text/placeholders and conditional visibility in separate disclosures. Keep the technical answer key under Advanced; editing it requires an explicit Update and confirmation, rather than firing while typing. Below configuration, provide Move up/down, Duplicate question, and Delete question, with Done editing as the final full-width action. Reordering works by pointer or keyboard without dragging. Deletion names the item in a confirmation dialog and explains that it affects the draft. Historical published versions remain unchanged.

### Conditional logic and Review Rules

Conditional visibility begins with “Only show this question for certain answers”. Show an Answer to dropdown containing human question labels, a readable operator, and a typed answer control. Boolean and acknowledgement values use explicit true/false choices; scale values use numbers. Support all/any matching, add/remove conditions, and preserve existing mixed condition groups until the coach deliberately changes them. Do not let a question depend on itself.

Review rules use a separate inspector with plain-language guidance that these are deterministic coach-attention cues. Each rule is an amber-bordered disclosure with a 3px amber leading rule, a human flag message, and the same condition editor. Source references follow the selected questions. Add review rule is unavailable without questions to reference. Never use medical risk scores, diagnoses, or generated clinical advice in this editor.

Form settings contains the form name, public title/description, welcome and success copy, and client identity mapping. Identity dropdowns use question labels. Place the public link and archive action after ordinary configuration. Archiving requires confirmation and saves pending valid changes first.

### Save states and recovery

Keep save state visible in the header: Unsaved changes, Saving…, Saved, Not saved, or Draft conflict. Debounce ordinary edits by 700ms and serialize writes. A completed older request must never replace newer typing. Advance the base revision only after a successful server response and save the latest pending snapshot next.

Flush pending edits before Agent requests, proposal preview, Apply, Publish, and leaving through Forms. Show failures persistently and retain edits. Network errors offer Retry. Revision conflicts block writes and publication; offer Download my edits and Load saved draft, with confirmation before discarding local work. Never resolve a conflict by silently retrying against the new revision.

Keep a per-form recovery snapshot in session storage while the draft is dirty and warn on browser exit. Restore it only as unsaved work; if its base revision differs from the current server draft, show a conflict. The recovery download is JSON for preserving work, not a new form-import feature. Clear the recovery snapshot only after successful save or explicit discard. Local recovery does not claim durable cloud storage.

### Preview and publishing

Preview is a dedicated full-width workspace with “Preview your draft”, a concise no-submission explanation, and the shared Mobile / Desktop preview selector. The mobile frame is at most 390px and the desktop frame at most 1160px. Allow the actual renderer to adapt to its container; never shrink a desktop screenshot to simulate a phone. Trial answers never become client submissions.

Publish remains in the workspace header. Open a confirmation that summarizes the current draft and explains that the published version becomes available to clients while historical submissions remain linked to their original version. Flush edits before publishing. A conflict or validation failure prevents publication. During publication, prevent competing mutations. After success, announce publication and show “Published · Up to date”. Compare draft content, identity mapping, and review rules with the published snapshot; subsequent changes show “Published · Unpublished changes”. A saved draft is not the same as a published form.

### Feedback, accessibility, and motion

An empty form shows a short explanation and Add section; an empty Agent shows useful example requests. Use restrained loading labels and skeletons where content is pending. Keep save/Agent errors close to their work area without replacing the draft. Success is a persistent, dismissible green notice. Conflict warnings are amber with concrete recovery controls. Do not rely on transient toasts.

Use semantic headings, native disclosures and dialog focus behavior, visible control labels, programmatic button names, and textual statuses. Focus outlines are 2px forest with 3px offset. Touch actions are at least 44px, inputs 46px, mode controls 44px on small screens and 40px inside the 56px desktop toolbar; the Forms exit keeps a 44px hit area. Keep important feedback announced and preserve input values after errors. Buttons at reordering boundaries are disabled. Respect reduced motion: remove spinner animation and transitions; content stays readable and working state stays explicit. No decorative perpetual motion or layout animation is required.

## Review Flags and AI Coach Brief

Review Flags are deterministic, rule-based attention cues. Use amber background, amber heading, 3px leading rule, and the explicit label “Rule-based Review Flags”. Each flag includes its human-readable reason and source question labels. Example: “Coach review needed — Current injury or pain reported.” Do not use severity scores, risk meters, medical symbols, diagnoses, or treatment advice.

AI Coach Brief uses a separate sage surface, forest-green leading rule, and explicit “AI-generated context” labeling. It organizes responses into Summary, Goals, Training, Nutrition, Lifestyle & Recovery, Coaching Preferences, Things to Review, and Kickoff Conversation. Render only populated sections. Use 17px subsection headings and 13–15px body text. Thin dividers separate topics; do not turn every bullet into another card.

Each sourced statement can disclose the question labels it is based on. Source disclosures have accessible expanded state. “Things to Review” remains AI clarification, visually separate from deterministic flags. Failed generation offers Retry and explains that the original answers remain available. Loading does not obscure the original submission.

## Lists, modals, and feedback

Desktop lists use a leading document symbol or initial, a flexible title/identity column, supporting metadata, a status badge, and a small trailing arrow. The entire row may be a link, but do not nest interactive controls inside it. Long names and emails wrap. Mobile moves status and arrow beneath the identity while preserving the leading alignment; never hide status to fit a row.

Use native modal behavior for destructive confirmations: keyboard focus stays inside, Escape dismisses when no operation is pending, and focus returns to the trigger. Maximum width is 520px, padding 32px desktop / 24px mobile, radius 20px. Mobile dialogs sit near the bottom with safe margins and can scroll within 90dvh. The overlay is 40% dark green. Do not close a destructive dialog merely because a pointer misses its panel.

Client deletion identifies the client and precisely lists affected data. Require typed `DELETE`, keep Cancel available, and use the red destructive action. Explain that previously exported external copies are not removed. Workspace deletion is a separate pale-red danger area with the same typed confirmation and explicit scope. Routine configuration edits remain inline, not modal.

Empty states contain one small visual anchor, a 24px heading, one short explanation, and a relevant next action. Use a dashed structural border and a lightly surfaced background. No fabricated rows, metrics, or testimonials. Differentiate first use, an empty filter, and a genuine load failure.

Loading uses neutral skeleton blocks shaped like the pending content. Announce one loading message to assistive technology; decorative skeletons do not each announce. Use opacity-only animation and disable it for reduced motion.

Errors use direct copy and a concrete retry path. Keep data visible when only a secondary service fails. Warnings use amber and explain the decision needed. Success uses a small green status region near the initiating action. Do not depend on a disappearing toast for important state. The route error view offers Try again and a return to the workspace. A missing page offers a clear explanation and a home link.

## Connections UI patterns

Connections contains exactly two configuration regions: Google Sheets and Signed webhooks, followed by full-width recent deliveries. On wide screens the two regions sit side by side; tablet and mobile stack them. Each region has its service name, text status badge, destination information when present, and state-appropriate controls.

Google Sheets: not connected shows Connect; connected shows the spreadsheet destination, existing/new spreadsheet options, Test connection, and Disconnect; needs attention exposes Reconnect. If unavailable, use user-facing availability copy rather than environment variable names.

Signed webhooks: collect a name and HTTPS endpoint. Show signing details as technical guidance because the person configuring a receiver needs them. A newly created or rotated secret appears in a distinct panel with “Copy this signing secret now”. Do not show secrets in normal destination summaries or fixtures. Each destination exposes test, enable/disable, rotation, and retry controls supported by the product.

Delivery history is a divided list. A row shows event, text status, attempt count, last attempt time, source submission link, and Retry when supported. Failed delivery must say the onboarding remains stored. Do not imply that reconnecting or retrying recollects the client’s answers.

## Screen Patterns

### Landing

Use a restrained horizontal navigation with wordmark, in-page links, login, and primary start action. The hero is an asymmetric two-column composition: left editorial headline and concise product explanation, right an explicitly illustrative Agent-plus-client-form preview. A thin principles strip follows. Continue with an editorial explanation plus numbered steps, a three-perspective submission example, the two connections, and a quiet sage closing CTA. Do not add social proof, pricing, invented metrics, or testimonials. Mobile stacks copy before illustration, hides secondary desktop nav links, and retains the primary CTA.

### Login / Signup

Desktop uses two equal regions: a sage brand narrative on the left and the form on paper at right. The form has its own title, short instruction, vertically stacked labels, one full-width submit action, inline error, and a link to the alternate auth mode. Do not show a redundant mode toggle inside the form. Mobile keeps the wordmark and form, removes the narrative block, and uses 24px gutters. Password fields support correct autocomplete. Pending authentication leaves entered values intact.

### Coach Setup

Use a standalone page, not the workspace navigation. Show the brand, then a left contextual introduction and right white profile form. The coach sees why these details help the Agent. Group coaching types as selectable labeled controls and related yes/no preferences together. Submit creates the workspace. On mobile put the introduction above the full-width form; suppress secondary sidebar guidance. Never describe a route, database, or internal setup phase in product copy.

### Dashboard

Use a personalized welcome header with Create onboarding. The main column starts with the sage Agent entry panel, then a client attention list or a useful empty state. The secondary column contains a short three-step workflow, recent forms, and a connections link. Populate exclusively from workspace records. These are recent records, not total business metrics. At tablet width stack the contextual column after the main work. Mobile uses the same priority order with full-width controls.

### Forms List

Header: Forms, a short purpose statement, Create onboarding. Below: All forms / Draft / Published filter track and actual form count. Rows show form name, last updated date, version where available, status, and an edit affordance. A first-use state opens form creation. A filtered empty state returns to all forms. Mobile moves secondary status into a lower row rather than forcing a table to scroll.

### Create Form

Use a clear creation title and two-region layout: name plus three selectable starting methods at left; short process guidance at right. Methods are Create with AI, Start manually, and Start from current onboarding. AI is recommended, but only the actual selection receives selected styling. Submit opens the appropriate builder experience. Mobile stacks the guidance after the form. Use creation-specific pending and failure copy.

### Form Builder

Use the complete Form Builder Workspace specification above. Replace the ordinary app shell with a compact workspace toolbar that holds Forms, form identity, Agent / Build / Preview, save state, and Publish. Start Build with numbered, expanded sections and divided question rows; selecting an item opens a single inspector. Agent and Build are separate modes below 1100px, paired columns from 1100px, and Preview always occupies its own workspace. Save state and Publish remain visible. Preserve draft values and conversation when changing modes. Only explicit Apply changes mutates the draft; publishing is separate.

### Form Preview

Provide a clear Back to editor route and a Mobile / Desktop viewport selector. Show the actual client renderer inside a bordered preview frame, not a static picture. The phone frame is 390px maximum; desktop 1160px maximum. Adapt by container width, not only browser viewport width. Preview navigation stays inside the frame and does not cover workspace navigation. Preview never persists or submits real client answers; its final confirmation states that explicitly.

### Public Client Onboarding

Use the complete Public Client Onboarding specification above. Structure: business identity, welcome or section progress, focused question group, save disclosure, sticky Back / Continue. At wide container sizes add the 240px orientation rail beside a 600px column. On mobile remove the rail; preserve progress, readable labels, and touch controls. Success becomes a concise receipt. Pacing never changes published answer keys or visibility semantics.

### Clients List

Use an explicit search field and search action, followed by All / New / Needs review / Reviewed filters. A row contains initials, full name, email, latest form/date, and latest review status. The identity is the strongest element. Preserve search across filtering and filter across searching. Empty results offer Clear filters; a truly empty workspace explains how clients arrive from published onboarding.

### Client Detail

Start with All clients, then a contact identity header. Name is dominant; email and optional phone are secondary. Export data and Delete client data remain distinct actions. Explain export/deletion scope without occupying the primary heading. Follow with a divided onboarding history list containing form, version, timestamp, and review status. Mobile stacks actions beneath identity. Do not introduce a CRM pipeline, booking, or messaging.

### Submission Detail

Header identifies the client, form, version, submission time, review status, and Mark reviewed when applicable. Optional snapshot and notes precede the detailed review. Provide anchor navigation for Original answers, Review Flags, and AI Coach Brief.

Desktop uses a wider white original-answer column and a narrower context column. The context column puts amber deterministic flags above the sage AI brief. Answers retain the client’s words and group by form section, using definition-list labels and values. Tablet stacks the columns; mobile puts attention/brief context before the full original answers, with anchors for quick access to either. Never blend generated prose into submitted answers. The visual distinction survives grayscale through headings, labels, borders, and layout.

### Settings

Use a workspace title and a primary settings column. Group coaching profile, connected tools, and data export into separate simple white regions. A quiet secondary explanation can sit to the right. The destructive workspace area appears below normal settings with red semantics and typed confirmation. Mobile stacks everything. Do not add billing, subscriptions, teams, notification preferences, or unsupported appearance toggles.

### Coaching Profile

Keep the standard shell and a clear heading explaining how the profile informs the Agent. Use a 720px maximum white form surface with generous vertical spacing. Identity, coaching types, target clients, related preferences, philosophy, and programming considerations form a predictable top-to-bottom sequence. Save profile is the main action; success is announced near the button. Mobile retains the same grouping with full-width fields. Updating profile does not imply republishing forms.

### Connections

Use the two-destination layout described above. Put integration status and destination configuration before delivery history. Desktop uses two columns only when controls fit comfortably; smaller widths stack. Long endpoint URLs and errors wrap. Failed deliveries provide context and retry, while original submissions remain available.

## Responsive Rules

Responsiveness changes composition, not just font sizes. Support 320px through wide desktop without body-level horizontal scrolling. Test at 390px, 768px, 1024px, 1440px, and 1920px, plus a 320px stress width.

| Region | Desktop | Tablet / laptop | Mobile |
| --- | --- | --- | --- |
| Workspace navigation | Fixed 232px sidebar | 192px sidebar at 768–1199px | Five-item bottom navigation; no sidebar |
| Page header | Title left, action right | Wrap when needed | Title, description, then full-width action group |
| Dashboard | Main work + context column | Single column below 1200px | Main task, attention, then context |
| Builder | Agent 380px + flexible Build from 1100px; Agent 420px from 1500px | One full-width mode below 1100px | Agent / Build / Preview; no global bottom navigation |
| Builder structure | Section overview or selected inspector; independent pane scrolling | Same | Inspector replaces overview; All sections returns |
| Public onboarding | 240px rail + 80px gap + 600px question column at container ≥1000px | Center 600px column; rail disappears below 1000px container | 20px gutters (16px below 360px); short question groups; sticky actions become static when keyboard is detected |
| Preview | Frame follows chosen width | Container query adapts renderer | Frame fits available width; no scaled desktop screenshot |
| Submission | Answers + flags/brief context | Stacked columns | Context first, answers next, anchor navigation |
| Connections | Two destination columns + delivery list | Stack below 1200px | Full-width forms, actions wrap, URLs break safely |
| Lists | Identity + metadata + status in one row | Wrap metadata | Status moves below identity; no horizontal table |
| Auth | Narrative + form | Two regions while readable | Brand + form; narrative removed |
| Setup | Introduction + form | Keep only if fields remain usable | Introduction above form |
| Modal | Centered, max 520px | Centered, viewport-constrained | Near bottom, 16px outside margin, internal scroll |

At narrow widths, preserve task actions, errors, status, and source labels. Hide only redundant contextual decoration. Never hide validation, destructive consequences, Apply/Reject, or the current step. Do not shrink interactive text below its specified minimum to force a layout. Container queries below 700px ensure mobile preview matches a narrow embedded container even on a desktop browser.

## Accessibility and interaction principles

- Use semantic main, nav, aside, section, headings, form labels, fieldsets, legends, and definition lists. One principal H1 per page.
- Keep visible keyboard focus: 2px green outline with 3px offset. Do not remove it in favor of hover alone.
- Make targets at least 44px where touch interaction is expected; public choices are at least 48px. Small visual icons may live inside larger hit areas.
- Maintain WCAG AA text contrast: 4.5:1 for normal text, 3:1 for large text. Controls and focus indicators need visible boundaries. Check actual coach colors before extending custom branding.
- Active routes expose current-page state. Toggle choices expose selection/pressed state. Disclosures expose expanded state. Progress has a name and numeric value.
- Inputs have names independent of placeholders. Errors are associated with the field where possible and announced. Do not communicate invalid state only by changing border color.
- Use a skip-to-content link in the workspace. Dialogs trap focus through native dialog behavior and restore focus when closed.
- Preserve entered values on validation and network errors. Prevent duplicate submissions and duplicate destructive actions.
- Save state must be honest: distinguish unsaved, saving, saved, conflict, and failure. A published version stays live until the coach publishes a new version.
- AI proposals require explicit Apply. Reject is always visible. A generated summary never silently edits original answers or changes review status.
- Use inline editing and disclosure before introducing new dialogs. Keep essential actions outside long scroll regions when practical.
- Respect browser zoom, text wrapping, safe areas, and reduced motion. Never disable pinch zoom or replace native scrolling with inertia.

## Motion guidance

Motion supports state feedback, not spectacle. Use 150ms color/border changes for controls. Skeletons may pulse opacity over 1500ms. Existing press feedback may scale to 0.98 for a single interaction; do not animate whole panels on every edit. Avoid layout-shifting entrance sequences, parallax, animated type, pulsing AI gradients, and perpetual decorative motion. Under reduced motion, remove animations, transitions, and smooth scrolling. Progress still updates immediately.

## Copy and tone

Use complete, plain English in the product. Sentence case. Explain what happened and the next useful step. Prefer “Create onboarding”, “Apply changes”, “Publish”, “Mark reviewed”, “Test connection”, and “Retry”. Avoid “Oops”, exclamation-heavy success messages, vague “Something magical”, and claims about outcomes the product cannot guarantee.

Say “AI-generated from the client’s onboarding responses”, not “clinical assessment”. Say “Current injury or pain reported”, not “high-risk client”. Say “Delivery failed. Your client’s onboarding is safely stored”, not “submission lost”. Separate AI suggestions from client statements in both copy and layout.

Never expose implementation phases, database status, route placeholders, internal revision terminology beyond useful draft/version context, or environment variable names in routine product flows. Technical webhook signing instructions are appropriate within connection configuration. Sample data belongs only in explicitly labeled design/development surfaces.

## What NOT to do visually

- No purple AI gradients, glowing chatbot bubbles, glassmorphism, or neon fitness imagery.
- No bodybuilding stock photography, invented testimonials, fake revenue, or fake metrics.
- No medical severity scales, diagnostic badges, traffic-light health scores, or medical iconography.
- No excessive cards inside cards. Use borders, space, and section headings first.
- No pill-shaped everything, random radii, heavy shadows, or multiple competing accent colors.
- No oversized all-caps monospaced headings in normal workspace content.
- No small desktop dashboard squeezed into a phone. Change navigation and panel composition.
- No unlabeled input, hover-only action, icon-only critical status, or disabled-looking active control.
- No AI content visually merged with original answers. No Review Flag styled as an AI suggestion.
- No new visual system for an isolated screen. Extend the existing patterns deliberately.

## AI Handoff Instructions

1. Treat `design.md` as the visual source of truth. Read it before designing or implementing a Coaching screen.
2. Reuse existing tokens, layouts, and components before inventing new ones. Map semantic tokens to your framework or design tool without changing their values.
3. Preserve the hierarchy: task, original client information, explicit attention cues, AI context, then configuration.
4. Preserve the responsive transformations. Verify mobile modes, safe areas, wrapped rows, and embedded preview behavior.
5. Do not introduce unsupported product features, integrations, data, or claims.
6. Do not introduce another color, typography, spacing, or motion system without explicitly updating this document and the shared implementation together.
7. Keep proposed, applied, published, submitted, flagged, and reviewed states distinct. Never imply an action occurred before it did.
8. Include empty, pending, error, success, and conflict states wherever the flow can produce them. Test keyboard and touch behavior.
9. Compare desktop and mobile output with the current implementation. If a major design decision changes, update this document in the same change.
10. Treat gallery examples as design fixtures, not product records. Preserve authentication, workspace isolation, data integrity, and the existing backend contracts.
