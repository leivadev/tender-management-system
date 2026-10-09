# Tender Management System

API on Cloudflare Workers (Hono + chanfana/OpenAPI) to draft, send, track, resolve and collect on commercial tenders. See `README.md` for setup and design decisions.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local `wrangler dev` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Lint + formatting (Biome), read-only |
| `npm run check:fix` | Apply Biome fixes |
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL` from `.env`, not Hyperdrive) |
| `npm run test` | `vitest run` — E2E suite against a real local Supabase (see `tests/`) |
| `npm run deploy` | Build `client/` + `wrangler deploy` to production |

Before considering any change in `src/` done, run `npm run typecheck`, `npm run check` and `npm run test` — all must be clean. `test` needs the local Supabase running (see README, section "Supabase local").

## Code architecture

- `src/endpoints/**` — one file per endpoint, each a chanfana `OpenAPIRoute` class (Zod schema + `handle()`). This is how the Swagger UI at `/api/docs` is generated automatically (`/` serves the SPA from `client/`).
- `client/` — standalone SPA (Vite + React + TypeScript + Tailwind + TanStack Query) with its own `package.json`. It builds to `client/dist/` and the Worker serves it through the `assets` binding in `wrangler.jsonc`. `cd client && npm run dev` runs it locally (port 5173, proxies `/api/*` to `wrangler dev` on 8787).
- `src/domain/tenders/` — the only layer that knows the tender business rules: `state-machine.ts` (transitions), `rules.ts` (budget, mandatory proposal), `payments.ts` (balance, atomic payment).
- `src/services/` — external integrations: `storage.ts` (R2), `email.ts` (Resend), `auth.ts` (Supabase Admin API).
- `src/jobs/tenders.ts` — expiry/reminder logic, invoked from `scheduled()` in `src/index.ts`.
- `src/middleware/` — `auth.ts` (verifies the Supabase JWT against JWKS, loads the profile) and `roles.ts` (`requireRole`, `blockViewerWrites`: the `viewer` role is read-only).
- `src/db/schema.ts` — the single Drizzle schema file, with `relations()` inline.

## Invariants that must not be broken

1. **No endpoint writes `tenders.status` directly.** Every transition goes through `transitionTender()` in `state-machine.ts`, which validates against the `VALID_TRANSITIONS` whitelist and writes the history in the same operation. If you need a new status or transition, add it there, not in the endpoint.
2. **The Worker at runtime never uses `DATABASE_URL` directly.** Every Postgres connection goes through the `env.HYPERDRIVE` binding (`src/db/client.ts`). `DATABASE_URL` only exists in `.env` for `drizzle-kit`.
3. **Payments are recorded inside a transaction with `SELECT ... FOR UPDATE`** (`payments.ts`) — this avoids race conditions between concurrent requests and the cron.
4. **`SUPABASE_SECRET_KEY` is only used server-side** (`services/auth.ts`, admin API) — it must never travel to the client or be logged.
5. **No secrets are added to `wrangler.jsonc`.** They go in `.dev.vars` (local) or `wrangler secret put` (production); both are gitignored except the `.example` files.

## Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be out of date. Check the current documentation before touching Workers, Hyperdrive, R2, Cron Triggers, or Node.js compat.

- Docs: https://developers.cloudflare.com/workers/
- Limits: `/workers/platform/limits/`
- Node.js compat: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Errors: https://developers.cloudflare.com/workers/observability/errors/
- This project uses `hyperdrive` and `r2_buckets` bindings + `nodejs_compat`. Run `wrangler types` after touching `wrangler.jsonc`.

This project **does not use** Durable Objects, Queues, Vectorize or Workers AI — do not add them unless the README justifies it.

## Testing status

`tests/api.test.ts`, `tests/cron.test.ts`, `tests/english.test.ts`, `tests/inactive-products.test.ts`, `tests/pagination.test.ts` and `tests/uniqueness.test.ts` — 123 cases with `@cloudflare/vitest-pool-workers` (runs inside the real Workers runtime, against the real bindings from `wrangler.jsonc` and the local Supabase). They cover auth, roles, CRUD (including editing clients/products/users/tenders via `PATCH`), budget, the 10 invalid + 4 valid state-machine transitions, product locking in the 4 terminal statuses, invoicing, payments (partial/overpayment/full), cron (expiry + reminder + idempotency), dashboard, audit, uniqueness (product names, user emails, one line per product in a tender), product deactivation (admin toggle, 422 on adding an inactive product, existing lines kept) and pagination (envelope, limits, order, 10,000-tender latency). Shared helpers live in `tests/helpers.ts`. If you add new logic, add its case there — do not assume that compiling = working.

The frontend (`client/`) has no automated tests — it is verified manually in the browser.

Note: `vitest run` may show 1-2 "Stream was cancelled" errors at the end — that is Miniflare closing Postgres.js connections when the test file finishes, not a real failure (the asserts do run and do fail the suite if something is wrong).

## Known pending items

- Deployed to production (`wrangler deploy` + secrets via `wrangler secret put`) — but the Cron Trigger was never confirmed firing on its own in that real environment (locally it does not fire automatically).
- The frontend (`client/`) has no automated tests (only the backend, via `npm run test`).

Before deploying to production or touching secrets, confirm with the user — these are steps with external effects.

## Agent skills

### Issue tracker

GitHub Issues (`leivadev/tender-management-system`, via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/` at the root). See `docs/agents/domain.md`.
