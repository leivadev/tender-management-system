import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	test: {
		setupFiles: ["./tests/setup.ts"],
		testTimeout: 20000,
		dangerouslyIgnoreUnhandledErrors: true,
	},
});
