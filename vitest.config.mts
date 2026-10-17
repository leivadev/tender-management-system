import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	test: {
		// The SPA has its own jsdom suite (client/vitest.config.ts).
		exclude: [...configDefaults.exclude, "client/**"],
		setupFiles: ["./tests/setup.ts"],
		testTimeout: 20000,
		hookTimeout: 30000,
		dangerouslyIgnoreUnhandledErrors: true,
	},
});
