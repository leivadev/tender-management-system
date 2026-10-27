import { describe, expect, it } from "vitest";
import srs from "../docs/SRS.md?raw";

// Appendix B: a requirement verified by test (T) is only closed when a test cites its ID (NFR-03, NFR-23).
const sources = import.meta.glob("./*.test.ts", { query: "?raw", import: "default", eager: true }) as Record<
	string,
	string
>;
const clientSources = import.meta.glob("../client/src/**/*.test.{ts,tsx}", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

const cited = new Set<string>();
for (const [file, text] of Object.entries({ ...sources, ...clientSources })) {
	if (file.endsWith("traceability.test.ts")) continue;
	for (const m of text.matchAll(/\b(?:BR|FR|NFR|SEC|UI|DAT|IF)-\d+/g)) cited.add(m[0]);
}

const rows = [...srs.matchAll(/^\| ((?:BR|FR|NFR|SEC|UI|DAT|IF)-\d+) \|.*\| ([TID, ]+) \|$/gm)].map((m) => ({
	id: m[1],
	methods: m[2],
}));

describe("requirements traceability (NFR-03, NFR-23)", () => {
	it("the SRS requirement table was parsed (NFR-03)", () => {
		expect(rows.length).toBeGreaterThan(100);
	});

	it("every requirement verified by test (T) is cited by at least one test (NFR-03)", () => {
		const missing = rows.filter((r) => r.methods.includes("T") && !cited.has(r.id)).map((r) => r.id);
		expect(missing).toEqual([]);
	});
});
