# Tender Management System

[![CI](https://github.com/leivadev/tender-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/leivadev/tender-management-system/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Full-stack app to draft, send, track, resolve and collect on commercial tenders ("licitaciones"). A tender belongs to a client, bundles products with quantities and prices, requires a formal proposal document, and must be emailed to the client before its deadline. Overdue tenders are lost automatically; payments are tracked until the tender is fully collected.

- **Backend:** Hono + chanfana (OpenAPI/Swagger at `/api/docs`) on Cloudflare Workers
- **Data:** Supabase (Postgres + Auth) via Drizzle ORM and Hyperdrive
- **Integrations:** Cloudflare R2 (proposal files), Resend (email with attachment), Cron Triggers (expiry + 48h reminder)
- **Roles:** `admin` (manages users), `user` (full access to tenders) and `viewer` (read-only; every non-GET request is rejected by one middleware, and write actions are hidden in the UI)
- **Frontend:** Vite + React + TypeScript + Tailwind + TanStack Query, served by the same Worker through the `assets` binding
- **Quality:** 62 end-to-end tests running inside the real Workers runtime against a real local Supabase

**Live demo:** https://tender-management-system.leivadev.com — sign in with `demo@leivadev.com` / `Demo-Tenders-2026` (read-only viewer account). Swagger UI at `/api/docs`.

![Dashboard](docs/screenshots/dashboard.png)

| | |
|---|---|
| ![Tenders list](docs/screenshots/tenders-list.png) | ![Products](docs/screenshots/tender-products.png) |
| ![Payments](docs/screenshots/tender-payments.png) | ![History](docs/screenshots/tender-history.png) |

## Tender lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> active: send (proposal required, email sent)
    active --> finalized: finalize
    active --> lost: mark lost / deadline passed (cron)
    finalized --> for_collection: invoice
    for_collection --> collected: balance reaches zero
    collected --> [*]
    lost --> [*]
```

Any transition not drawn above is rejected. Every transition is recorded in an audit history (previous status, new status, user, timestamp).

## Design decisions

- **`transitionTender()` is the only writer of `tenders.status`.** It validates against a whitelist (`VALID_TRANSITIONS`) and writes the history row in the same operation, so no endpoint or job can skip the state machine or leave history out of sync. New states or transitions are added there, not in endpoints (`src/domain/tenders/state-machine.ts`).
- **Payments use `SELECT ... FOR UPDATE` inside a transaction.** Concurrent payment requests and the cron job can touch the same tender; locking the row makes the balance check and the insert atomic, so overpayment and double-collection can't happen (`src/domain/tenders/payments.ts`).
- **Reminders are idempotent through an atomic guard.** The 48h reminder runs `UPDATE ... WHERE reminder_sent_at IS NULL`; only the run that flips the column sends the email, so overlapping or retried cron runs never double-send (`src/jobs/tenders.ts`).
- **Hyperdrive instead of direct Postgres connections.** The Worker never reads `DATABASE_URL` at runtime; all queries go through the `HYPERDRIVE` binding, which pools connections so short-lived isolates don't open a new Postgres connection per request. `DATABASE_URL` exists only for `drizzle-kit` migrations.
- **Tender edits are restricted to title and description.** `PATCH /api/tenders/:id` never accepts `maxBudget`, `deadline`, `clientId` or `status`, so edits can't bypass budget validation, the expiry cron or the state machine.
- **R2 for proposal files.** S3-compatible API, no egress fees, same provider as the Worker. Files are served through an authenticated endpoint (`GET /api/tenders/:id/proposal/download`), never a public bucket URL.
- **Secrets never live in `wrangler.jsonc`.** Local values go in `.dev.vars`, production values in `wrangler secret put`. `SUPABASE_SECRET_KEY` is used only server-side.

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
tests/                    # E2E: api.test.ts, cron.test.ts
scripts/                  # create-admin.mjs, seed-mock.mjs
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

For demo data, `node scripts/seed-mock.mjs --confirm` wipes clients, products, tenders and payments and repopulates them with sample records (users are untouched).

### 6. Cloudflare: R2 and Hyperdrive

```bash
npx wrangler r2 bucket create tender-proposals
npx wrangler hyperdrive create tender-management-db \
  --connection-string="<your DATABASE_URL from the pooler>"
```

Put the returned `id` in `wrangler.jsonc` (`hyperdrive[0].id`). It is an identifier, not a secret. Local development ignores it and uses `localConnectionString`.

### 7. Run locally

```bash
npm run dev                                # Worker on :8787, Swagger UI at /api/docs
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

The suite uses `@cloudflare/vitest-pool-workers`, so tests run inside the real Workers runtime with the bindings from `wrangler.jsonc`. It covers auth, roles, CRUD (including edits), budget validation, the full state machine (valid and invalid transitions), product locking, invoicing, payments (partial, overpayment, full), cron (expiry, reminder, idempotency), dashboard and audit trail. Tests that send email use the Resend test recipient `delivered@resend.dev` and need a valid `RESEND_API_KEY` in `.dev.vars`.

CI (`.github/workflows/ci.yml`) runs typecheck, Biome and the full suite on every push and pull request. It expects a `RESEND_API_KEY` repository secret.

## Deploy

```bash
npm run deploy   # builds client/ then wrangler deploy
```

The Worker is served on the custom domain declared in `wrangler.jsonc` (`routes`); change `pattern` to a hostname on a zone in your Cloudflare account.

Set production secrets (each prompts for the value):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM
npx wrangler secret put APP_BASE_URL   # public URL of the deployed Worker
```

Then create the production admin with `scripts/create-admin.mjs`, pointing `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `DATABASE_URL` at the remote project.

## License

[MIT](LICENSE)
