import { createClient } from "@supabase/supabase-js";

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

	if (error || !data.user) {
		throw new Error(`Failed to create auth user: ${error?.message}`);
	}

	return data.user;
}
