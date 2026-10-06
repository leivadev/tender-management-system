import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		// Only used for local/CI migrations, never by the Worker at runtime.
		url: process.env.DATABASE_URL as string,
	},
});
