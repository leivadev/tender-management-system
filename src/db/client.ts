import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof getDb>;

/**
 * The Worker never opens a direct TCP connection to Supabase Postgres.
 * env.HYPERDRIVE.connectionString is a pooled connection managed by Cloudflare.
 */
export function getDb(env: Env) {
	const sql = postgres(env.HYPERDRIVE.connectionString, {
		max: 5,
		fetch_types: false,
	});
	return drizzle(sql, { schema });
}
