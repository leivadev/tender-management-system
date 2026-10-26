import { describe, expect, it } from "vitest";

// Source files and project config read as text at build time (the Workers runtime has no filesystem).
const backendSources = import.meta.glob<string>("../src/**/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
});
const clientSources = import.meta.glob<string>(["../client/src/**/*.ts", "../client/src/**/*.tsx"], {
	query: "?raw",
	import: "default",
	eager: true,
});
const tsconfigs = import.meta.glob<string>(
	["../tsconfig.json", "../client/tsconfig.app.json", "../client/tsconfig.node.json"],
	{ query: "?raw", import: "default", eager: true },
);
const clientPackage = import.meta.glob<string>("../client/package.json", {
	query: "?raw",
	import: "default",
	eager: true,
});
const rootPackage = import.meta.glob<string>("../package.json", {
	query: "?raw",
	import: "default",
	eager: true,
});
const ciWorkflow = import.meta.glob<string>("../.github/workflows/ci.yml", {
	query: "?raw",
	import: "default",
	eager: true,
});
const biomeConfig = import.meta.glob<string>("../biome.json", {
	query: "?raw",
	import: "default",
	eager: true,
});

const only = (files: Record<string, string>) => Object.values(files)[0] ?? "";

// tsconfig files are JSONC (comments), so check the option rather than parse them.
const strictOn = /"strict"\s*:\s*true/;

// Matches `any` as a type (`: any`, `as any`, `<any>`, `any[]`) and Zod's `z.any()`.
const ANY_TYPE = /(:\s*any\b|\bas\s+any\b|<any>|\bany\[\]|\bz\.any\(\))/;

function offenders(files: Record<string, string>): string[] {
	return Object.entries(files)
		.filter(([, text]) => ANY_TYPE.test(text.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")))
		.map(([path]) => path);
}

describe("TypeScript strictness (NFR-04)", () => {
	it("NFR-04: strict mode is on for the backend and both SPA configs", () => {
		expect(Object.keys(tsconfigs)).toHaveLength(3);
		for (const [path, text] of Object.entries(tsconfigs)) {
			expect(strictOn.test(text), `${path} must enable strict`).toBe(true);
		}
	});

	it("NFR-04: the SPA linter is installed, has a script and runs in CI", () => {
		const pkg = JSON.parse(only(clientPackage));
		expect(pkg.devDependencies.oxlint).toBeDefined();
		expect(pkg.scripts.lint).toContain("oxlint");
		expect(pkg.scripts.lint).toContain("--deny-warnings");
		expect(JSON.parse(only(rootPackage)).scripts["lint:client"]).toContain("client");
		expect(only(ciWorkflow)).toContain("npm run lint:client");
	});
});

describe("No `any` (NFR-05)", () => {
	it("NFR-05: the backend source has no `any` type or z.any()", () => {
		expect(Object.keys(backendSources).length).toBeGreaterThan(20);
		expect(offenders(backendSources)).toEqual([]);
	});

	it("NFR-05: the SPA source has no `any` type", () => {
		expect(Object.keys(clientSources).length).toBeGreaterThan(20);
		expect(offenders(clientSources)).toEqual([]);
	});

	it("NFR-05: Biome reports explicit `any` as an error in source", () => {
		expect(JSON.parse(only(biomeConfig)).linter.rules.suspicious.noExplicitAny).toBe("error");
	});
});
