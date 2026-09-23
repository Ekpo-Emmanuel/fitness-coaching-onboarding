# PRODUCTION_CHECKLIST.md

Never put real secrets in this file.

## Core

- [ ] `DATABASE_URL` (Neon)
- [ ] `BETTER_AUTH_SECRET` (long random)
- [ ] `BETTER_AUTH_URL` (https production origin)
- [ ] `INTEGRATION_ENCRYPTION_KEY` — `openssl rand -hex 32`
- [ ] Migrations applied (`drizzle-kit migrate`, current includes `0006_phase8_hardening`)
- [ ] HTTPS
- [ ] Neon snapshot/backup before migrate

## AI (optional until Agent/Coach Brief used)

- [ ] `DEEPSEEK_API_KEY`
- [ ] `DEEPSEEK_MODEL` (default `deepseek-flash`)
- [ ] optional `DEEPSEEK_COACH_BRIEF_MODEL`

## Integrations (optional until Connections used)

- [ ] Google Cloud: Sheets API, OAuth web client
- [ ] Production redirect URI: `{BETTER_AUTH_URL}/api/integrations/google/callback`
- [ ] `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] optional `GOOGLE_OAUTH_REDIRECT_URI`

## Maintenance

- [ ] `CRON_SECRET` (`openssl rand -hex 32`)
- [ ] Scheduler: Vercel Cron `GET /api/internal/maintenance` (see `vercel.json`) with `CRON_SECRET` set. Hobby plans may only run daily. Alternative: POST the same path with `Authorization: Bearer <CRON_SECRET>` every 5 minutes.

## Legacy V1 (compatibility only)

V1 is not mounted at `/`. Keep Sheets env only if you still call `POST /api/onboarding` from the unmounted renderer.

- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] `GOOGLE_PRIVATE_KEY`
- [ ] `GOOGLE_SHEETS_SPREADSHEET_ID`

## Security

- [ ] `TRUST_PROXY=true` behind a reverse proxy
- [ ] Confirm CSP does not break login
- [ ] Dev routes `/dev/*` 404 in production
- [ ] Rate limiting: in-app limiter is per instance; add platform WAF/rate limits for public submit

## Migration process

1. Snapshot the Neon branch/database.
2. Deploy an application version compatible with the new schema (expand then migrate).
3. Run `npx drizzle-kit migrate`.
4. Verify `__drizzle_migrations` includes `0006_phase8_hardening`.
5. Rollback: restore the snapshot. Do not edit applied SQL files.

## Verification

- [ ] Create account, coach onboarding, dashboard
- [ ] Agent create/edit, publish
- [ ] Public `/f/[slug]` submit
- [ ] `/` landing (not V1 client onboarding)
- [ ] `/clients` review flag + Coach Brief + mark reviewed
- [ ] Google delivery and webhook failure/retry
- [ ] Client export + delete (type DELETE)
- [ ] `GET /api/health` returns `{ "ok": true }`

## V1 files

Keep V1 files marked compatibility until they are explicitly deleted. Clients use `/f/[slug]`. Do not remount the V1 renderer at `/`.
