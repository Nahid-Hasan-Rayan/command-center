# Command Center

Personal planning workspace with sign-in, per-person feature access, messaging, file sharing and sandboxed custom tools.

Author: Nahid Hasan Rayan

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Without them the app refuses to serve any page.

## Verify

```bash
npm run verify
npm run db:test
npm run e2e
```

- `verify`: lint, type check, unit tests, production build.
- `db:test`: applies the migrations to a local PostgreSQL with pgTAP and runs every test in `supabase/tests`.
- `e2e`: starts a mock Supabase and checks the running app (build it first with `NEXT_PUBLIC_SUPABASE_URL=http://localhost:3199`, start it on port 3112 with `SEED_WORKSPACE_ID=none`).

## Security model

- Email and password plus a required authenticator-app code. The proxy sends every request through the gate in `src/domain/access-gate.ts`.
- The database also requires a second-factor session (`aal2`) for every table, so a stolen first-factor session reads nothing.
- Row-level security on every table. Access is by workspace role (owner, editor, viewer) and by an allow-list of features per member.
- Invitations are single-use, hashed, bound to one confirmed email and expire.
- Custom HTML tools run in a sandboxed frame with no network access. See `supabase/migrations/20261005000300_widgets.sql` and `src/domain/widgets.ts`.

## Layout

- `src/domain`: pure logic (calendar, timetable, attendance, grading, features, access gate, files, messages, widgets).
- `src/lib`: Supabase clients, session helpers, validation, widget bridge.
- `src/app`, `src/components`: pages and UI.
- `src/proxy.ts`: authentication gate, nonce and Content Security Policy.
- `supabase/migrations`, `supabase/tests`: schema, policies, pgTAP tests.
- `scripts/local-db`, `scripts/e2e`: local verification.

## Setup after deploying

1. Create the Supabase project and run `supabase db push`.
2. In Supabase Authentication: confirm email, turn off open sign-ups until you want to invite someone, enable TOTP MFA.
3. Create your account, set up the authenticator app, then copy your workspace id from the Today page and set `SEED_WORKSPACE_ID` in the deployment settings.
4. Set the backup secrets listed in `.github/workflows/backup.yml`.
