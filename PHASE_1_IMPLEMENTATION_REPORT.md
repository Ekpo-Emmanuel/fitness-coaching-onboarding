# Phase 1 Implementation Report

Phase 1 adds product identity (Postgres, Better Auth, workspace, coaching profile, protected shell, tests) **around** the working V1 client onboarding. V1 behavior was not redesigned.

## Packages added

**Runtime:** `better-auth`, `@better-auth/drizzle-adapter`, `drizzle-orm`, `@neondatabase/serverless`

**Dev:** `drizzle-kit`, `vitest@3.2.4`, `@vitejs/plugin-react@4`, `jsdom`, `vite-tsconfig-paths`, `@playwright/test`

Vitest 5 was not used because it conflicted with `@types/node@20`.

## Database architecture

Neon Postgres via the HTTP driver (`drizzle-orm/neon-http`). Drizzle schema lives in `lib/db/schema.ts`.

Tables:

- Better Auth: `user`, `session`, `account`, `verification`
- Product: `workspace`, `workspace_member`, `coaching_profile`

`workspace_member` unique on `(workspace_id, user_id)`. Role is text (`owner` now; `coach` / `assistant` allowed later). One `coaching_profile` per workspace (`workspace_id` unique).

Google Sheets is unchanged and remains V1 canonical storage for client submissions.

## Migration files

- `drizzle/0000_phase1_foundation.sql`
- `drizzle/meta/_journal.json`

Scripts: `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`.

Migrations are **not** applied in this environment because `DATABASE_URL` is still empty. Do not use `drizzle-kit push` as the production path.

## Better Auth architecture

- Email + password
- Drizzle adapter (pg)
- `nextCookies()` plugin for server actions
- Catch-all `app/api/auth/[...all]/route.ts`
- Client: `lib/auth-client.ts`
- Lazy `getAuth()` so public `/` does not initialize the database

Sessions are Better Auth cookies (session token), not the password.

## Routes added

| Route | Role |
| --- | --- |
| `/login` | Sign in / create account |
| `/onboarding` | **Coach** setup (not the client form) |
| `/dashboard` | Protected product shell |
| `/settings`, `/settings/profile` | Edit Coaching Profile |
| `/api/auth/[...all]` | Better Auth |
| `/coach/login` | Redirects to `/login` |

Public client onboarding remains `/`.

## Workspace resolution

`requireWorkspace()` / `getWorkspaceContext()` in `lib/workspace/session.ts`:

1. Read Better Auth session from request headers
2. Load memberships for that user
3. Phase 1 uses the first membership (no switcher)
4. Require a CoachingProfile
5. Incomplete setup redirects to `/onboarding`
6. Unauthenticated users redirect to `/login`

Private updates never take `workspaceId` from the client. Profile writes use the resolved workspace.

## CoachingProfile implementation

Created at coach setup; edited at `/settings/profile`. Server validation in `lib/workspace/profile.ts`. Arrays stored as JSON. Logo upload deferred. Optional philosophy / programming fields stored as text.

## Legacy coach authentication

Removed:

- `COACH_DASHBOARD_PASSWORD` from `.env.example` and from application code
- `emmanuel_coach` cookie comparison
- `POST /api/coach/login` and `POST /api/coach/logout`
- `lib/coach/session.ts`

`proxy.ts` now only checks for a Better Auth session cookie (optimistic). Pages and `/api/coach/notes` validate the session and workspace on the server.

`/coach/onboarding` still reads Google Sheets. Notes still write to the CLIENTS tab.

If `COACH_DASHBOARD_PASSWORD` remains in a local env file, it is unused. Delete it locally.

## Tests added

**Vitest (26):** `tests/validate.test.ts` (13), `tests/health-flags.test.ts` (13). Result: **26 passed**.

**Playwright (1):** `e2e/public-onboarding.spec.ts` — `/` loads, Start Onboarding, About you. Result: **1 passed**.

Pre-existing lint on V1 autosave `setState` in `OnboardingFlow.tsx` is eslint-overridden so Phase 1 does not change V1 form code.

## Environment variables

Server-only:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (example: `http://localhost:3000`)
- existing Google Sheets variables

No `NEXT_PUBLIC_*` secrets.

## Manual setup steps

1. Create a Neon project and paste the connection string into `DATABASE_URL` (must not stay empty)
2. Confirm `BETTER_AUTH_SECRET` is a long random value
3. `npm run db:migrate`
4. `npm run dev`
5. Open `/login`, create an account, complete `/onboarding`, open `/dashboard`
6. Confirm `/` is still public client onboarding

## V1 regression verification

- Production build lists `/` as a static public route
- Playwright: welcome → About you without login
- `POST /api/onboarding` route handler unchanged
- `lib/onboarding/validate.ts` and `health-flags.ts` unchanged
- Sheets client/repository unchanged
- `schema_version` still `onboarding_v1` in constants
- `gym_name` still always visible (not “fixed”)

Live Sheets submit was not re-run in this phase after auth work; the submit path was not modified. Dev server still serves `/`.

## Documented product decisions (not implemented)

- Current Sheets coach notes should become **submission notes** in Phase 5, not general client notes
- Historical Sheet import is Phase 5
- `gym_name` visibility freeze until a later FormVersion

## Known limitations

- `DATABASE_URL` must be set and migrations applied before signup/dashboard work
- Neon HTTP driver: setup inserts are sequential, not a single SQL transaction
- Phase 1 users are expected to have one workspace; the schema still allows more memberships
- Proxy cookie check is optimistic; authorization is in `requireWorkspace`
- No workspace switcher, no team roles UI, no Form/Client models
- Full signup→dashboard E2E against Neon was not run here (no live database)

## Intentionally deferred

Agent, schema renderer, FormVersion, client/submission tables, Sheets destination abstraction, webhooks, AI, Stripe, rate limiting on public submit.

## Concrete deviation from planning docs

Coach setup is `/onboarding` as specified. V1 form **components** still live under `app/onboarding/` but the public client URL remains `/`. Do not treat `app/onboarding/page.tsx` as the client form in Phase 2.
