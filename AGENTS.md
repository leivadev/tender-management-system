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
| `npm run test:client` | SPA component tests (Vitest + Testing Library + jsdom, `client/src/**/*.test.tsx`) — run when touching `client/` |
| `npm run deploy` | Build `client/` + `wrangler deploy` to production |

Before considering any change in `src/` done, run `npm run typecheck`, `npm run check` and `npm run test` — all must be clean. `test` needs the local Supabase running (see README, section "Supabase local").

## Code architecture

- `src/endpoints/**` — one file per endpoint, each a chanfana `OpenAPIRoute` class (Zod schema + `handle()`). The spec is served at `/openapi.json` (session required, FR-45); the Worker serves no docs pages — Swagger UI is the SPA route `/docs` (`client/src/routes/DocsPage.tsx`). `/` serves the SPA from `client/`.
- `client/` — standalone SPA (Vite + React + TypeScript + Tailwind + TanStack Query) with its own `package.json`. It builds to `client/dist/` and the Worker serves it through the `assets` binding in `wrangler.jsonc`. `cd client && npm run dev` runs it locally (port 5173, proxies `/api/*` to `wrangler dev` on 8787).
  - UI conventions: semantic Tailwind tokens from `client/src/styles/index.css` (`bg-card`, `text-muted-foreground`, `bg-primary-soft`, `--tone-*`), never raw gray/blue palette classes. Shared pieces in `components/` (Radix tooltip/dialog, `Table`, `DisabledAction`, `CommandPalette` with Cmd/Ctrl+K and `g`+key shortcuts). Pages are lazy-loaded in `App.tsx`. List filters live in URL params (`useListParams`); search is server-side (`q`, plus `sort`/`dir` on tenders).
  - Login: the one-click button is ONLY for the read-only demo account (`demo@leivadev.com`). Admin/writer credentials must never appear in `client/`.
- `src/domain/tenders/` — the only layer that knows the tender business rules: `state-machine.ts` (transitions), `rules.ts` (budget, mandatory proposal, draft-only budget/deadline, deadline in the future), `payments.ts` (balance, atomic payment), `locking.ts` (`withLockedTender()`, the row-locked transaction every tender mutation runs in).
- `src/services/` — external integrations: `storage.ts` (R2), `email.ts` (Resend), `auth.ts` (Supabase Admin API, password sign-in with the end-user IP forwarded, sign-out). Provider settings are documented in `docs/deployment.md`; changing the remote provider config needs the maintainer's explicit approval.
- `src/domain/clients/archiving.ts` — client archive/restore; locks the client row so archiving serialises with tender creation (`assertClientSelectable`).
- `src/domain/users/archiving.ts` — user archive/restore and role changes; locks all non-archived admin rows so the last admin can never be demoted or archived. Archiving also deletes the user's `auth.sessions` and bans them via `services/auth.ts`.
- `src/jobs/tenders.ts` — expiry/reminder logic, invoked from `scheduled()` in `src/index.ts`.
- `src/middleware/` — `auth.ts` (verifies the Supabase JWT against JWKS, loads the profile) and `roles.ts` (`requireRole`, `blockViewerWrites`: the `viewer` role is read-only).
- `src/db/schema.ts` — the single Drizzle schema file, with `relations()` inline.

## Invariants that must not be broken

1. **No endpoint writes `tenders.status` directly.** Every transition goes through `transitionTender()` in `state-machine.ts`, which validates against the `VALID_TRANSITIONS` whitelist and writes the history in the same operation. If you need a new status or transition, add it there, not in the endpoint.
2. **The Worker at runtime never uses `DATABASE_URL` directly.** Every Postgres connection goes through the `env.HYPERDRIVE` binding (`src/db/client.ts`). `DATABASE_URL` only exists in `.env` for `drizzle-kit`.
3. **Every operation that modifies a tender runs inside `withLockedTender()`** (`locking.ts`: one transaction with `SELECT ... FOR UPDATE` on the tender) — lines, budget/deadline, proposal, send, finalize, lost, invoice, payments and the cron expiry. This avoids race conditions between concurrent requests and the cron. A new tender mutation (e.g. archive) must use it, and must read and write through the `tx` it receives.
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

## Demo data

`scripts/seed-demo.mjs` seeds ~48 realistic tenders (idempotent, never deletes; `--fresh` wipes business data and refuses non-local hosts). Always pass `DATABASE_URL` inline: the one in `.env` points to PRODUCTION. Seeding production needs the user's explicit OK.

## Testing status

`tests/api.test.ts`, `tests/auth-hardening.test.ts`, `tests/client-archive.test.ts`, `tests/cron.test.ts`, `tests/dashboard.test.ts`, `tests/english.test.ts`, `tests/inactive-products.test.ts`, `tests/integrity.test.ts`, `tests/invoice-correction.test.ts`, `tests/pagination.test.ts`, `tests/search.test.ts`, `tests/send.test.ts`, `tests/tender-mutations.test.ts`, `tests/uniqueness.test.ts` and `tests/user-archive.test.ts` — 308 cases with `@cloudflare/vitest-pool-workers` (runs inside the real Workers runtime, against the real bindings from `wrangler.jsonc` and the local Supabase). They cover auth, roles, login rate limiting (forwarded IP, provider 429 -> `RATE_LIMITED`, stubbed in `tests/setup.ts`), logout revoking sessions, password policy (min 12, no password endpoints), CRUD (including editing clients/products/users/tenders via `PATCH`), budget, the 10 invalid + 4 valid state-machine transitions, product locking in the 4 terminal statuses, invoicing, invoice correction (admin only, `for_collection` without payments, no cap, status unchanged), payments (partial/overpayment/full), cron (expiry, 48h reminder with hours remaining, retry after email failure or timeout, overlapping runs, send with <48h marking the reminder), dashboard (summary + metrics), audit, uniqueness (product names, user emails, one line per product in a tender), client archive/restore (admin only, `archived=only|include`, 409 with open tenders, 422 on new tenders, race with tender creation), user archive (ban + session revocation, 401 for archived tokens, self-protection, last-admin lock), product deactivation (admin toggle, 422 on adding an inactive product, existing lines kept) data integrity (text limits, money bounds, CHECK constraints, indexes), row-locked mutations (concurrent line additions, send, double send, budget vs lines), draft-only budget/deadline edits and deadline rules (past deadline, send 422, drafts never expire), pagination (envelope, limits, order, 10,000-tender latency), send (email first, 502 `EMAIL_DELIVERY_FAILED`, content, HTML escaping) and list search/sort (`q` on tenders/clients/products, `sort`/`dir` on tenders). Shared helpers live in `tests/helpers.ts`. If you add new logic, add its case there — do not assume that compiling = working.

The frontend (`client/`) has a small jsdom suite (`npm run test:client`) for accessibility/behaviour rules (UI-04..09: confirm dialog, inline-edit keys, headings, mobile list columns, drawer); layout and visuals are still verified manually in the browser. Shared helpers: `client/src/test/render.tsx`.

Note: `vitest run` may show 1-2 "Stream was cancelled" errors at the end — that is Miniflare closing Postgres.js connections when the test file finishes, not a real failure (the asserts do run and do fail the suite if something is wrong).

## Known pending items

- Deployed to production (`wrangler deploy` + secrets via `wrangler secret put`) — but the Cron Trigger was never confirmed firing on its own in that real environment (locally it does not fire automatically).
- The frontend test suite only covers the accessibility rules above; no end-to-end browser tests.

Before deploying to production or touching secrets, confirm with the user — these are steps with external effects.

## Agent skills

### Issue tracker

GitHub Issues (`leivadev/tender-management-system`, via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/` at the root). See `docs/agents/domain.md`.
