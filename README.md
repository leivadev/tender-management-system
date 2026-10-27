# Tender Management System

[![CI](https://github.com/leivadev/tender-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/leivadev/tender-management-system/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Full-stack app to draft, send, track, resolve and collect on commercial tenders ("licitaciones"). What the system must do (scope, lifecycle, business rules, roles and permissions) is specified in the [Software Requirements Specification](docs/SRS.md).

- **Backend:** Hono + chanfana (OpenAPI spec at `/openapi.json`, session required) on Cloudflare Workers
- **Data:** Supabase (Postgres + Auth) via Drizzle ORM and Hyperdrive
- **Integrations:** Cloudflare R2 (proposal files), Resend (email with attachment), Cron Triggers (expiry + 48h reminder)
- **Frontend:** Vite + React + TypeScript + Tailwind + TanStack Query, served by the same Worker through the `assets` binding
- **Quality:** end-to-end tests running inside the real Workers runtime against a real local Supabase

## Live demo

| | |
|---|---|
| **App** | [tender-management-system.leivadev.com](https://tender-management-system.leivadev.com) |
| **API docs** | [Swagger UI](https://tender-management-system.leivadev.com/docs) (sign in first) |
| **Email** | `demo@leivadev.com` |
| **Password** | `Demo-Tenders-2026` |

The login page has an "Enter the live demo" button that signs in with this account in one click. It has the read-only `viewer` role, so you can browse every screen but not change data: write actions are disabled with a tooltip explaining why. Press `⌘K` / `Ctrl+K` anywhere to search tenders and clients or jump to a page (`g` then `d`/`t`/`c`/`p` also navigates).

![Dashboard](docs/screenshots/dashboard.png)

| | |
|---|---|
| ![Tenders list](docs/screenshots/tenders-list.png) | ![Products](docs/screenshots/tender-products.png) |
| ![Payments](docs/screenshots/tender-payments.png) | ![History](docs/screenshots/tender-history.png) |
| ![Command palette](docs/screenshots/command-palette.png) | ![Login](docs/screenshots/login.png) |

## Design decisions

How the requirements in the [SRS](docs/SRS.md) are met, and why.

- **`transitionTender()` is the only writer of `tenders.status`.** It validates against a whitelist (`VALID_TRANSITIONS`) and writes the history row in the same operation, so no endpoint or job can skip the state machine or leave history out of sync. New states or transitions are added there, not in endpoints (`src/domain/tenders/state-machine.ts`).
- **Payments use `SELECT ... FOR UPDATE` inside a transaction.** Concurrent payment requests and the cron job can touch the same tender; locking the row makes the balance check and the insert atomic, so overpayment and double-collection can't happen (`src/domain/tenders/payments.ts`).
- **Reminders are idempotent and retry on failure.** Each reminder runs under `withLockedTender()`: the email is sent first and `reminder_sent_at` is set only after it succeeds, so a failed send is retried by the next run and overlapping runs queue on the lock and never double-send. The send is capped at 10s so a hung provider cannot hold the lock. Delivery is at-least-once: if the email succeeds but the marker write then fails, the next run sends a second reminder. Sending a tender with under 48h left marks the reminder as already sent (`src/jobs/tenders.ts`).
- **Hyperdrive instead of direct Postgres connections.** The Worker never reads `DATABASE_URL` at runtime; all queries go through the `HYPERDRIVE` binding, which pools connections so short-lived isolates don't open a new Postgres connection per request. `DATABASE_URL` exists only for `drizzle-kit` migrations.
- **Strict CSP, escaped rendering.** The SPA is served with a Content Security Policy (`client/public/_headers`) that allows only same-origin scripts and forbids inline script execution; API text is only rendered through React's escaped output. The session token lives in `localStorage`, a deliberate trade-off documented in `docs/deployment.md`.
- **R2 for proposal files.** S3-compatible API, no egress fees, same provider as the Worker.
- **Secrets never live in `wrangler.jsonc`.** Local values go in `.dev.vars`, production values in `wrangler secret put`.

## Project structure

```text
src/
├── index.ts              # routes, middleware, scheduled() export
├── endpoints/            # one OpenAPI route per file (chanfana + Zod)
├── middleware/           # Supabase JWT auth and role checks
├── domain/tenders/       # state machine, business rules, payments
├── services/             # Supabase Admin, R2, Resend
├── jobs/                 # expiry and reminders (cron)
├── db/                   # Drizzle schema and client (via Hyperdrive)
└── lib/                  # HTTP errors, dates

client/                   # SPA (Vite + React + TS), served by the Worker
tests/                    # E2E suite (api, cron, dashboard, search, pagination, ...)
scripts/                  # create-admin.mjs, seed-demo.mjs, seed-mock.mjs
```

## Getting started

### Prerequisites

- Node.js 22+
- A Cloudflare account (`wrangler login`)
- A Supabase project (Postgres + Auth)
- A Resend account (a verified domain, or the `onboarding@resend.dev` sandbox sender)

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API Keys** copy `Project URL` (`SUPABASE_URL`), the `publishable` key (`SUPABASE_PUBLISHABLE_KEY`) and the `secret` key (`SUPABASE_SECRET_KEY`, never exposed to the browser).
3. In **Project Settings → Database → Connection string** pick the **Transaction pooler** (port 6543) and use it as `DATABASE_URL`. Avoid the direct connection (`db.<ref>.supabase.co:5432`): on many networks it only resolves over IPv6 and migrations/Hyperdrive hang without a clear error.

### 3. Environment variables

```bash
cp .dev.vars.example .dev.vars   # Worker runtime (wrangler dev)
cp .env.example .env             # drizzle-kit only (migrations)
```

Fill both files. They are gitignored.

### 4. Migrations

```bash
npm run db:migrate
```

Then run `drizzle/manual/profiles_auth_fk.sql` once in the Supabase SQL Editor. It adds the FK from `profiles.id` to `auth.users.id` (Drizzle doesn't know the Supabase-managed `auth` schema).

### 5. First admin user

Only admins can create users, so the first one is bootstrapped directly against Supabase:

```bash
set -a && source .dev.vars && source .env && set +a
node scripts/create-admin.mjs admin@example.com "YourStrongPassword123!"
# a read-only user, e.g. for a public demo:
node scripts/create-admin.mjs demo@example.com "DemoPassword123!" viewer
```

For demo data, `scripts/seed-demo.mjs` creates 48 tenders spread over the last six months (every status, history rows, partial and full payments), so the dashboard charts and activity feed have something to show. `DATABASE_URL` must be passed explicitly; do not reuse the production one from `.env` without meaning to.

```bash
# adds whatever is missing, never deletes; running it twice changes nothing
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/seed-demo.mjs --confirm
# local only: wipe all business data first (refused on non-local hosts)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/seed-demo.mjs --confirm --fresh
```

The older `node scripts/seed-mock.mjs --confirm` wipes clients, products, tenders and payments and repopulates them with a smaller sample (users are untouched).

### 6. Cloudflare: R2 and Hyperdrive

```bash
npx wrangler r2 bucket create tender-proposals
npx wrangler hyperdrive create tender-management-db \
  --connection-string="<your DATABASE_URL from the pooler>"
```

Put the returned `id` in `wrangler.jsonc` (`hyperdrive[0].id`). It is an identifier, not a secret. Local development ignores it and uses `localConnectionString`.

### 7. Run locally

```bash
npm run dev                                # Worker on :8787, Swagger UI in the SPA at /docs
cd client && npm install && npm run dev   # SPA on :5173, proxies /api/* to :8787
```

`wrangler.jsonc` points Hyperdrive's `localConnectionString` at a local Supabase Postgres (next section). To use the remote database instead:

```bash
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$(grep DATABASE_URL .env | cut -d '=' -f2-)"
```

### Local Supabase (minimal)

Postgres + Auth + gateway only, via the Supabase CLI (requires Docker):

```bash
npm install -g supabase
supabase start -x realtime,storage-api,imgproxy,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
supabase status   # API URL, DB URL and keys
```

Set `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` in `.env` and the local `SUPABASE_*` values in `.dev.vars`, then repeat steps 4 and 5 against it.

## Tests

```bash
npm run typecheck
npm run check      # Biome lint + format
npm run test       # needs local Supabase running
```

The suite uses `@cloudflare/vitest-pool-workers`, so tests run inside the real Workers runtime with the bindings from `wrangler.jsonc`. 506 cases. What they must cover is defined in the SRS (see Appendix B): every requirement verified by test (`T`) is cited by ID in a test name, and `tests/traceability.test.ts` fails if one is not. Documentation lives in [`/docs`](docs/): the SRS, `deployment.md` and the screenshots. Outgoing Resend requests are stubbed in `tests/setup.ts`, so tests never send real email and any non-empty `RESEND_API_KEY` works.

CI (`.github/workflows/ci.yml`) runs typecheck, Biome and the full suite on every push and pull request.

## Deploy

```bash
npm run deploy   # builds client/ then wrangler deploy
```

The Worker is served on the custom domain declared in `wrangler.jsonc` (`routes`); change `pattern` to a hostname on a zone in your Cloudflare account.

Upload the production secrets from an env file with the remote project values (same keys as `.dev.vars.example`). `APP_BASE_URL` is derived from the custom domain in `wrangler.jsonc`:

```bash
./scripts/put-secrets.sh .dev.vars.production
```

The script refuses to run if `SUPABASE_URL` is local, shows the target and asks for confirmation. Or set them one by one with `npx wrangler secret put <KEY>` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL`).

Authentication provider settings (rate limits, token lifetime, password policy, backups) are listed in [docs/deployment.md](docs/deployment.md); apply them to the remote project before going live.

Then create the production admin with `scripts/create-admin.mjs`, pointing `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `DATABASE_URL` at the remote project.

## License

[MIT](LICENSE)
