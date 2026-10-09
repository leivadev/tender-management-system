import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const [, , email, password, role = "admin"] = process.argv;

if (!email || !password || !["admin", "user", "viewer"].includes(role)) {
	console.error("Usage: node scripts/create-admin.mjs <email> <password> [admin|user]");
	process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !DATABASE_URL) {
	console.error("Missing environment variables: SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL");
	process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
	email,
	password,
	email_confirm: true,
});

if (error || !data.user) {
	console.error("Error creating the user in Supabase Auth:", error?.message);
	process.exit(1);
}

const sql = postgres(DATABASE_URL);
try {
	const [profile] = await sql`
		insert into profiles (id, email, role)
		values (${data.user.id}, ${email}, ${role})
		returning id, email, role
	`;
	console.log("User created:", profile);
} finally {
	await sql.end();
}
