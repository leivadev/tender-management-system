# Deployment: authentication provider configuration

Settings the production Supabase project must have (SEC-05). Local values live in `supabase/config.toml`; the hosted project is configured in the dashboard (**Authentication**) or through the management API.

Changing the remote provider configuration needs the maintainer's explicit approval. Nothing in this repo applies these values to production automatically.

## Required values

| Setting | Value | Requirement | Local (`config.toml`) | Dashboard |
|---|---|---|---|---|
| Sign-in rate limit, per IP | 10 per 5 minutes | FR-06 | `auth.rate_limit.token_refresh = 10`, `auth.rate_limit.sign_in_sign_ups = 10` | Authentication → Rate Limits |
| IP forwarding | enabled (`security_sb_forwarded_for_enabled`) | FR-06 | n/a (hosted only) | management API, see below |
| Access-token lifetime | 3600 s | SEC-17 | `auth.jwt_expiry = 3600` | Authentication → Sessions / JWT settings |
| Password minimum length | 12 | SEC-20 | `auth.minimum_password_length = 12` | Authentication → Sign In / Providers → Email |
| Password composition rules | none | SEC-20 | `auth.password_requirements = ""` | same |
| Daily database backups | enabled; retention per plan below | NFR-26 | n/a | Database → Backups |

Password sign-ins go through the provider's token endpoint, whose limit is `token_refresh`; `sign_in_sign_ups` covers sign-up and OTP flows. Both are set to 10 so the limit holds whichever the provider applies. The app never refreshes sessions (the client holds only an access token), so lowering `token_refresh` costs nothing.

Local Supabase does not enforce these rate limits on password sign-ins, so the Worker's behaviour (forwarded IP, `429` mapping) is tested against a stubbed provider response (`tests/auth-hardening.test.ts`).

## Per-end-user rate limiting (FR-06)

The provider limits by source IP. Every request from the Worker would otherwise share the Worker's address, so one visitor could lock everyone out. The login endpoint therefore signs in with the secret key and sends the visitor's address (`CF-Connecting-IP`) in the `Sb-Forwarded-For` header. The provider only honours that header after IP forwarding is enabled on the project:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"security_sb_forwarded_for_enabled": true}'
```

Until it is enabled, the limit applies to the Worker as a whole. A provider `429` is returned to the client as `429 RATE_LIMITED`.

## Sessions and logout (FR-02, SEC-17)

`POST /api/auth/logout` calls the provider's sign-out with the default `global` scope: all of the user's sessions end and their refresh tokens are revoked. The SPA discards its stored token whether or not the call succeeds.

**Residual risk (accepted):** an access token issued before logout stays valid until its `exp` claim, at most 1 hour, because the Worker verifies JWTs locally against the provider's JWKS. Archived accounts are closed immediately regardless (SEC-19). The lifetime is not reduced further to keep the provider's default behaviour and avoid constant re-login.

## Password policy (FR-03, SEC-20)

- Minimum 12 characters, no composition rules, enforced in the API (`POST /api/users`) and at the provider.
- Only admins set a password, when they create the user. No endpoint of this API changes or recovers passwords (the OpenAPI spec lists none).
- The provider's own endpoints (`/auth/v1/user`, `/auth/v1/recover`) are reachable only with the project's publishable key, which the Worker holds and never sends to the browser. Treat that key as a deployment secret.

## Backups (NFR-26)

Supabase backs up Pro, Team and Enterprise projects daily. Retention: Pro 7 days, Team 14 days, Enterprise 30 days (Point-in-Time Recovery for shorter recovery points). Free-plan projects have **no** downloadable backups; export with `supabase db dump` instead.

| Item | Value |
|---|---|
| Plan of the production project | _to be confirmed by the maintainer_ |
| Daily backups enabled | _to be confirmed by the maintainer_ |
| Retention | _to be confirmed by the maintainer (7 days on Pro)_ |

## Data API exposure (SEC-03, SEC-12, SEC-13, SEC-14)

The app reaches Postgres only through the Worker (Hyperdrive, owner role). The provider's Data API (PostgREST/GraphQL) must reach nothing:

- RLS is enabled on every `public` table (`enableRLS()` in `src/db/schema.ts`) and no policy exists.
- Migration `0010_revoke_data_api_access` revokes all privileges on `public` tables and sequences from `anon` and `authenticated`, and alters the default privileges so tables and sequences created later are not granted to them. Supabase would otherwise grant them automatically.
- Hosted dashboard, **Project Settings → Data API → Exposed schemas**: remove `public` (SEC-13). Locally `supabase/config.toml` lists only `graphql_public`. This remote change needs the maintainer's approval, like the values above.

`tests/data-exposure.test.ts` checks RLS, policies, grants, the privileges of a table created on the spot, and that `anon`/`authenticated` are denied (`42501`) on every table. It also calls `/rest/v1` with the public key; the local stack runs without PostgREST (README), so there that only proves no data comes back. Run the migration against production only with the maintainer's approval.

## Applying to production

1. Maintainer approves the change.
2. Set the values above in the dashboard (or `PATCH /v1/projects/{ref}/config/auth`).
3. Fill in the backup table and the date applied here.
4. Smoke test: sign in, sign out, create a user with an 11-character password (expect `400`).

## Logs and correlation ids (NFR-27, NFR-19, NFR-20, SEC-07)

An unexpected failure answers `500 INTERNAL_ERROR` with a `correlation_id` in the error body and in the `X-Correlation-Id` header. The same id is on the matching log line (`src/lib/logging.ts`), so a reported id finds the failure in `wrangler tail` or the Workers logs. Cron and best-effort cleanup failures are logged the same way, with their own id.

Log lines are JSON with the id, request method and path, and the error's shape: class name, driver codes (SQLSTATE, constraint, table, column) and stack frames. Error messages are never logged, because driver and provider messages can echo query parameters, emails or tokens.

**Residual risk (accepted):** Workers `observability` also records each request URL. List searches send `?q=` in the URL, so a search for an email is visible in those platform logs, outside the application's control.
