import { createClient } from "@supabase/supabase-js";
import { AppError } from "../lib/errors";

/**
 * Admin client authenticated with the secret key. Only ever instantiated
 * inside the Worker — the secret key must never reach the browser.
 */
export function getSupabaseAdminClient(env: Env) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
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
