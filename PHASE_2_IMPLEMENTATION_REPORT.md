# Phase 2 Implementation Report

Phase 2 converts the hard-coded V1 client onboarding into a serializable schema engine plus shared renderer and validation. The public form stays at `/`. This is not Form/FormVersion persistence, not `/f/[slug]`, and not AI.

## Phase 2 status

**Complete.** The V1 onboarding is encoded as `emmanuelOnboardingV1`. `/` renders that schema. Browser and `POST /api/onboarding` share the same validation engine. Sheets, health flags, `schema_version`, and the API response contract are unchanged.

## Schema architecture

```
OnboardingSchema
  → validateSchemaDefinition()
  → visibility evaluator
  → validation engine
  → OnboardingRenderer / FieldRenderer
  → OnboardingAnswers (Record<string, unknown>)
```

Domain files:

- `lib/onboarding/schema/types.ts` — serializable types (no functions, no React)
- `lib/onboarding/schema/definition.ts` — structural schema validator + answer-key collection
- `lib/onboarding/schema/visibility.ts` — structured `show` conditions
- `lib/onboarding/schema/engine.ts` — field / section / full-form validation
- `lib/onboarding/schema/client-keys.ts` — exact 86-key regression set
- `lib/onboarding/schemas/emmanuel-onboarding-v1.ts` — V1 fixture

## Field types supported

`short_text`, `long_text`, `email`, `phone`, `date`, `number`, `single_select`, `multi_select`, `boolean`, `scale`, `acknowledgement`, `unit_number`.

Discriminated unions keep type-specific config required (options, scale bounds, unit keys). The V1 fixture does not use `boolean`; the engine still supports it.

`unit_number` stores answers on existing V1 keys (`height_value` / `height_unit` / `height_inches`, `weight_value` / `weight_unit`) while rendering as one control.

Presentation grouping uses `group` / `groupTitle` (meals, macros). Data keys are unchanged.

## Conditional logic system

Schema stores only structured objects:

```ts
{ action: "show", all?: Condition[], any?: Condition[] }
```

Operators: `equals`, `not_equals`, `contains`, `not_contains`, `is_empty`, `is_not_empty`.

Hidden fields are not required. V1 conditionals preserved, including `gym_name` always visible.

## Validation architecture

Client section Continue, client final Submit, and `validateSubmission()` all call the same engine.

Rules: required, email, past date, number min/max/integer, option membership, multi-select minItems, acknowledgement must be `true`, unit ranges by selected unit, ft/in companion pairing, unknown keys rejected.

`validateStep(step, data)` remains as a thin wrapper over schema section index (`step - 1`) so existing tests and any leftover call sites stay stable.

## V1 schema fixture

`emmanuelOnboardingV1`:

- id `schema_emmanuel_onboarding_v1`
- `schemaVersion` `onboarding_v1`
- `estimatedMinutes` `8–12` (string, matching the existing product copy)
- `storageKey` `emmanuel_onboarding_v1`
- 10 form sections (Welcome and Success are intro/success, not answer sections)

Section order: About You, Health & Safety, Training Background, Training Logistics / Schedule, Goals, Nutrition, Lifestyle & Recovery, Progress Tracking, Coaching Preferences, Final Check.

System keys (`submission_id`, `submitted_at`, `schema_version`, health flags, coach fields) are not client questions.

## Stable field IDs/keys

Every section and field has a stable `id` in the fixture (`sec_*`, `fld_*`). Field `key` values match the existing V1 payload keys. `unit_number` expands to value + unit + optional companion keys in `collectAnswerKeys()`.

## Specialized renderers

- `OnboardingRenderer` — steps, progress, groups, autosave, submit, success
- `FieldRenderer` — maps types to existing `app/onboarding/ui/fields.tsx` primitives
- `UnitNumberField` — height cm vs ft/in, weight lb/kg

Field components do not talk to Sheets, workspace, or the database.

## Autosave behavior

Same localStorage key: `emmanuel_onboarding_v1`. Existing in-progress drafts still restore. Phase 3 can introduce per-form keys later.

## Server submission compatibility

`POST /api/onboarding` still:

1. Parses JSON
2. `validateSubmission(payload)` (now schema-backed)
3. `submitOnboarding(data)`
4. Returns `{ ok: true, submission_id }` or the existing 400/502/503 shapes

## Google Sheets compatibility

`lib/onboarding/service.ts`, `field-map.ts`, and the Sheets repository were not redesigned. `ONBOARDING_RESPONSES` still receives the same client keys plus server-generated fields. `CLIENTS` projection is unchanged. `schema_version` remains `onboarding_v1`.

## Health flag compatibility

`lib/onboarding/health-flags.ts` is unchanged. It still reads the same answer keys. Rules Engine extraction stays Phase 6.

`/coach/onboarding` remains the hard-coded Sheets UI.

## Tests added

- `tests/schema-definition.test.ts` — structure, exact 86 keys, JSON round-trip
- `tests/schema-behavior.test.ts` — visibility (injuries, medical yes/unsure, macros, gym_name, medications, related health details)
- Existing `tests/validate.test.ts` (13) and `tests/health-flags.test.ts` (13) still pass against the schema engine
- Playwright: welcome → About You → validation error → Back → representative fields → injury conditional; mocked submit from restored draft (no live Sheet write)

## Build verification

| Check | Result |
| --- | --- |
| TypeScript (`next build`) | Pass |
| ESLint | Pass |
| Vitest | 39 passed |
| Playwright | 2 passed |
| Production build | Pass (`/` static; auth/dashboard dynamic) |

The `react-hooks/set-state-in-effect` override remains necessary. Autosave hydration still `setState`s in `useEffect`. The override moved from `OnboardingFlow.tsx` to `OnboardingRenderer.tsx`.

## Files added/changed

**Added**

- `lib/onboarding/schema/*`
- `lib/onboarding/schemas/emmanuel-onboarding-v1.ts`
- `app/onboarding/OnboardingRenderer.tsx`
- `app/onboarding/FieldRenderer.tsx`
- `app/onboarding/specialized/UnitNumberField.tsx`
- `tests/schema-definition.test.ts`
- `tests/schema-behavior.test.ts`
- `tests/fixtures/valid-client-answers.json`
- `PHASE_2_IMPLEMENTATION_REPORT.md`

**Changed**

- `app/onboarding/OnboardingFlow.tsx` — thin wrapper around the schema renderer
- `app/onboarding/ui/fields.tsx` — ChoiceList/MultiChoice accept schema options
- `lib/onboarding/validate.ts` — schema-backed wrappers
- `e2e/public-onboarding.spec.ts`
- `eslint.config.mjs` — lint override path

**Unchanged (intentionally)**

- `lib/onboarding/health-flags.ts`, `field-map.ts`, Sheets client, `/api/onboarding` contract
- Coach onboarding UI
- Phase 1 auth / workspace / dashboard

## Behavior differences from V1

Final client Submit now runs full-schema `validateAnswers` before POST. If the user went Back and cleared a required field, the client jumps to the first error section instead of only failing on the server. Valid submissions are unchanged.

No other intentional product changes.

## Known limitations

- `OnboardingDraft` still exists for Sheets/service typing; the renderer uses `OnboardingAnswers`.
- `boolean` is supported but unused in the V1 fixture.
- `estimatedMinutes` is static copy, not computed.
- Coach review is not schema-driven.
- Playwright mocked submit restores localStorage rather than clicking every section.

## Deferred work

Phase 3: Form, FormDraft, FormVersion, `/forms`, `/f/[slug]`. Phase 6: Rules Engine. Phase 7: destination adapters.

## Phase 3 readiness

The V1 schema is JSON-serializable, structurally validated, and uses stable IDs/keys. A future FormVersion can store this object as content. Public slug routing and builder UI are not started.
