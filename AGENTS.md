# Sistema de Gestión de Licitaciones

API en Cloudflare Workers (Hono + chanfana/OpenAPI) para redactar, enviar, dar seguimiento, resolver y cobrar licitaciones comerciales. Ver `README.md` para setup y decisiones de diseño.

## Comandos

| Comando | Propósito |
|---|---|
| `npm run dev` | `wrangler dev` local |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Lint + formato (Biome), sin escribir |
| `npm run check:fix` | Aplica fixes de Biome |
| `npm run db:generate` | Genera migración Drizzle desde `src/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones (usa `DATABASE_URL` del `.env`, no Hyperdrive) |
| `npm run test` | `vitest run` — suite E2E contra Supabase local real (ver `tests/`) |
| `npm run deploy` | Build de `client/` + `wrangler deploy` a producción |

Antes de dar por terminado cualquier cambio en `src/`, correr `npm run typecheck`, `npm run check` y `npm run test` — deben quedar limpios. `test` necesita el Supabase local levantado (ver README, sección "Supabase local").

## Arquitectura del código

- `src/endpoints/**` — un archivo por endpoint, cada uno una clase `OpenAPIRoute` de chanfana (schema Zod + `handle()`). Así se genera el Swagger UI en `/api/docs` automáticamente (`/` sirve la SPA de `client/`).
- `client/` — SPA independiente (Vite + React + TypeScript + Tailwind + TanStack Query), `package.json` propio. Se compila a `client/dist/` y el Worker la sirve vía el binding `assets` de `wrangler.jsonc`. `cd client && npm run dev` para levantarla en local (puerto 5173, hace proxy de `/api/*` hacia `wrangler dev` en 8787).
- `src/domain/tenders/` — la única capa que conoce las reglas de negocio de licitaciones: `state-machine.ts` (transiciones), `rules.ts` (presupuesto, propuesta obligatoria), `payments.ts` (saldo, pago atómico).
- `src/services/` — integraciones externas: `storage.ts` (R2), `email.ts` (Resend), `auth.ts` (Supabase Admin API).
- `src/jobs/tenders.ts` — lógica de vencimiento/recordatorio, invocada desde `scheduled()` en `src/index.ts`.
- `src/middleware/` — `auth.ts` (verifica JWT de Supabase contra JWKS, carga el profile) y `roles.ts` (`requireRole`).
- `src/db/schema.ts` — único archivo de schema Drizzle, incluye las `relations()` inline.

## Invariantes que no se deben romper

1. **Ningún endpoint escribe `tenders.status` directamente.** Toda transición pasa por `transitionTender()` en `state-machine.ts`, que valida contra la whitelist `VALID_TRANSITIONS` y escribe el historial en la misma operación. Si necesitas un nuevo estado o transición, se agrega ahí, no en el endpoint.
2. **El Worker en runtime nunca usa `DATABASE_URL` directo.** Toda conexión a Postgres pasa por el binding `env.HYPERDRIVE` (`src/db/client.ts`). `DATABASE_URL` sólo existe en `.env` para `drizzle-kit`.
3. **Los pagos se registran dentro de una transacción con `SELECT ... FOR UPDATE`** (`payments.ts`) — evita condiciones de carrera entre requests concurrentes y el cron.
4. **`SUPABASE_SECRET_KEY` sólo se usa server-side** (`services/auth.ts`, admin API) — nunca debe viajar al cliente ni loguearse.
5. **No se agregan secretos a `wrangler.jsonc`.** Van en `.dev.vars` (local) o `wrangler secret put` (producción); ambos gitignorados salvo los `.example`.

## Cloudflare Workers

STOP. Tu conocimiento de las APIs y límites de Cloudflare Workers puede estar desactualizado. Verifica la documentación actual antes de tocar Workers, Hyperdrive, R2, Cron Triggers, o Node.js compat.

- Docs: https://developers.cloudflare.com/workers/
- Límites: `/workers/platform/limits/`
- Node.js compat: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Errores: https://developers.cloudflare.com/workers/observability/errors/
- Este proyecto usa `hyperdrive` y `r2_buckets` bindings + `nodejs_compat`. Corre `wrangler types` después de tocar `wrangler.jsonc`.

Este proyecto **no usa** Durable Objects, Queues, Vectorize ni Workers AI — no agregar sin que el README lo justifique.

## Estado de testing

`tests/api.test.ts` y `tests/cron.test.ts` — 65 casos con `@cloudflare/vitest-pool-workers` (corre dentro del runtime real de Workers, contra los bindings reales de `wrangler.jsonc` y el Supabase local). Cubren auth, roles, CRUD (incl. edición vía `PATCH` de clientes/productos/usuarios/licitaciones), presupuesto, las 10 transiciones inválidas + 4 válidas de la máquina de estados, bloqueo de productos en los 4 estados terminales, facturación, pagos (parcial/sobrepago/completo), cron (vencimiento + recordatorio + idempotencia), dashboard y auditoría. Si agregas lógica nueva, agrega su caso ahí — no asumas que compila = funciona.

El frontend (`client/`) no tiene tests automatizados — se verifica manualmente en navegador.

Nota: `vitest run` puede mostrar 1-2 "Stream was cancelled" al final — es Miniflare cerrando conexiones de Postgres.js al terminar el archivo de test, no un fallo real (los asserts sí corren y sí fallan la suite si algo está mal).

## Pendientes conocidos

- Desplegado a producción (`wrangler deploy` + secrets vía `wrangler secret put`) — pero el Cron Trigger nunca se confirmó disparándose solo en ese ambiente real (en local no se dispara automáticamente).
- El frontend (`client/`) no tiene tests automatizados (solo el backend, vía `npm run test`).

Antes de desplegar a producción o tocar secrets, confirmar con el usuario — son pasos con efectos externos.
