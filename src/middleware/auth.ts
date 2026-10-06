import type { SupabaseEnv } from "@supabase/server";
import { withSupabase } from "@supabase/server/adapters/hono";
import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { getDb } from "../db/client";
import { profiles } from "../db/schema";
import { AppError } from "../lib/errors";

/**
 * `allow: 'user'` verifies the JWT locally against the project's JWKS (jose's
 * jwtVerify) instead of calling Supabase Auth per request. The library never
 * fetches it for us — module-scope cache persists across requests for the
 * lifetime of this Worker isolate.
 */
let cachedJwks: SupabaseEnv["jwks"] = null;

async function getJwks(supabaseUrl: string): Promise<SupabaseEnv["jwks"]> {
	if (cachedJwks) return cachedJwks;
	try {
		const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
		if (!res.ok) return null;
		cachedJwks = await res.json();
		return cachedJwks;
	} catch {
		return null;
	}
}

export type AuthedUser = {
	id: string;
	email: string;
	role: "admin" | "user";
};

export type AppBindings = {
	Bindings: Env;
	Variables: { user: AuthedUser };
};

/**
 * Validates the Bearer JWT against Supabase Auth. Must run before `loadProfile`.
 */
export function supabaseAuth(): MiddlewareHandler<AppBindings> {
	return async (c, next) => {
		const jwks = await getJwks(c.env.SUPABASE_URL);
		const middleware = withSupabase({
			allow: "user",
			env: {
				url: c.env.SUPABASE_URL,
				publishableKeys: { default: c.env.SUPABASE_PUBLISHABLE_KEY },
				secretKeys: { default: c.env.SUPABASE_SECRET_KEY },
				jwks,
			},
		});
		// withSupabase's own generics only know about its own Variables slice;
		// it only reads/writes c.var.supabaseContext, so this is safe.
		return middleware(c as never, next);
	};
}

/**
 * Reads the profile row (role) for the authenticated user and puts it in
 * `c.var.user`. Must run after `supabaseAuth`.
 */
export function loadProfile(): MiddlewareHandler<AppBindings> {
	return async (c, next) => {
		const context = (c.var as unknown as { supabaseContext?: { userClaims: { id: string } | null } })
			.supabaseContext;
		const claims = context?.userClaims;
		if (!claims) {
			throw new AppError("UNAUTHENTICATED", "Missing or invalid session.");
		}

		const db = getDb(c.env);
		const [profile] = await db.select().from(profiles).where(eq(profiles.id, claims.id));

		if (!profile) {
			throw new AppError("FORBIDDEN", "No profile found for this user.");
		}

		c.set("user", {
			id: profile.id,
			email: profile.email,
			role: profile.role as "admin" | "user",
		});

		await next();
	};
}
