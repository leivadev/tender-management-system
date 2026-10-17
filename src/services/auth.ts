import { createClient } from "@supabase/supabase-js";
import { AppError } from "../lib/errors";

/**
 * Admin client authenticated with the secret key. Only ever instantiated
 * inside the Worker — the secret key must never reach the browser.
 */
export function getSupabaseAdminClient(env: Env, headers?: Record<string, string>) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
		global: { headers },
	});
}

/**
 * Password sign-in on behalf of an end user (FR-06). The provider's per-IP rate limit only sees
 * the Worker's address unless it is told the real one; `Sb-Forwarded-For` is honoured for
 * requests made with a secret key once IP forwarding is enabled on the project, so this user-facing
 * call deliberately uses the secret-key client. It never leaves the Worker (invariant 4).
 */
export async function signInWithPassword(
	env: Env,
	email: string,
	password: string,
	clientIp: string | undefined,
) {
	const client = getSupabaseAdminClient(env, clientIp ? { "Sb-Forwarded-For": clientIp } : undefined);
	const { data, error } = await client.auth.signInWithPassword({ email, password });

	if (error?.status === 429 || error?.code === "over_request_rate_limit") {
		throw new AppError("RATE_LIMITED", "Too many sign-in attempts. Try again in a few minutes.");
	}
	if (error || !data.session) {
		throw new AppError("UNAUTHENTICATED", "Invalid email or password.");
	}

	return data.session;
}

/** Provider sign-out with the default `global` scope: ends the session and revokes its refresh tokens (FR-02). */
export async function signOutSession(env: Env, accessToken: string) {
	const { error } = await getSupabaseAdminClient(env).auth.admin.signOut(accessToken);
	if (error) {
		throw new Error(`Failed to sign out: ${error.message}`);
	}
}

export async function createAuthUser(env: Env, email: string, password: string) {
	const admin = getSupabaseAdminClient(env);
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
	});

	if (error?.code === "email_exists") {
		throw new AppError("CONFLICT", `A user with email ${email} already exists.`);
	}
	if (error || !data.user) {
		throw new Error(`Failed to create auth user: ${error?.message}`);
	}

	return data.user;
}

export async function deleteAuthUser(env: Env, id: string) {
	const { error } = await getSupabaseAdminClient(env).auth.admin.deleteUser(id);
	if (error) {
		throw new Error(`Failed to delete auth user: ${error.message}`);
	}
}

// ~100 years: Supabase has no "ban forever", only a duration.
const BAN_DURATION = "876000h";

/** Bans or unbans the user at the auth provider; a banned user cannot sign in or refresh a session. */
export async function setAuthUserBanned(env: Env, id: string, banned: boolean) {
	const { error } = await getSupabaseAdminClient(env).auth.admin.updateUserById(id, {
		ban_duration: banned ? BAN_DURATION : "none",
	});
	if (error) {
		throw new Error(`Failed to ${banned ? "ban" : "unban"} auth user: ${error.message}`);
	}
}
