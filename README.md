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
- Platform approval: a new sign-up is a registration request. Until the administrator approves it, the database denies every table to that account (`is_member` and `can_access` require an approved registration and a feature entitlement), and the app shows only `/pending`. Suspended, banned, archived and declined accounts are denied the same way.
- Custom HTML tools run in a sandboxed frame with no network access. See `supabase/migrations/20261005000300_widgets.sql` and `src/domain/widgets.ts`.

## Administration

The administrator is the account whose **confirmed** email equals `platform_settings.admin_email` (default `nhrayan@gmail.com`), signed in with the second factor. That account cannot be changed or removed by anyone else. It can make other approved people administrators.

- `/admin`: registration requests (name, email, WhatsApp, matric ID, reason), approve with chosen features or decline, change a person's features, suspend or restore, make or remove administrators, and remove a person.
- Removal always asks for an explicit choice: **suspend** (reversible), **archive** (keeps data, reversible), **ban** (also blocks that email from registering again) or **delete** (erases the account and its data, and needs the email typed again).
- `/admin/audit`: append-only record of every administrator action. It is only readable through `admin_audit_list`.
- Settings live in `platform_settings` (change in the SQL editor): `registration_mode` (`approval` or `open`), `default_features` (granted automatically in `open` mode), `admin_email`.
- People who already had an account when this was added are approved with every feature.
- An invitation created by an administrator pre-approves the invitee. An invitation from anyone else does not.
- Sign-up shows a notice that the administrator can see registration details and activity inside the app.

## Study

`/study` is the planner, modelled on the Mastery Hub reference (see `docs/mastery-hub-reference.md`).

- Add the DSA, HCI, OS and Agile courses with one tap; each brings its full unit list (252 units).
- Set an exam date per course. The page shows the phase, the units per study day you need, and a workload check across all courses against your daily goal.
- Next best actions, a 7-day plan with rest days and spaced reviews, a focus timer that logs to a course, manual time, past papers, and a streak.
- Courses and units are shared inside a workspace (editors change them). Progress, sessions, papers and settings are private to each person.
- The planning maths lives in `src/domain/study-plan.ts` and is covered by unit tests.

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
