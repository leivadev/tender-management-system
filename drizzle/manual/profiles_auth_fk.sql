-- Drizzle doesn't know about the auth.users table (managed by Supabase Auth,
-- lives in a different schema), so this FK has to be added by hand.
ALTER TABLE "profiles"
	ADD CONSTRAINT "profiles_id_auth_users_id_fk"
	FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
