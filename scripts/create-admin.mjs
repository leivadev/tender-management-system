import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const [, , email, password] = process.argv;

if (!email || !password) {
	console.error("Uso: node scripts/create-admin.mjs <email> <password>");
	process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !DATABASE_URL) {
	console.error("Faltan variables de entorno: SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL");
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
	console.error("Error creando el usuario en Supabase Auth:", error?.message);
	process.exit(1);
}

const sql = postgres(DATABASE_URL);
try {
	const [profile] = await sql`
		insert into profiles (id, email, role)
		values (${data.user.id}, ${email}, 'admin')
		returning id, email, role
	`;
	console.log("Admin creado:", profile);
} finally {
	await sql.end();
}
