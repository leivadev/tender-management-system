import { describe, expect, it } from "vitest";
import srs from "../docs/SRS.md?raw";

// Appendix B: a requirement verified by test (T) is only closed when a test cites its ID (NFR-03).
const sources = import.meta.glob("./*.test.ts", { query: "?raw", import: "default", eager: true }) as Record<
	string,
	string
>;
const clientSources = import.meta.glob("../client/src/**/*.test.{ts,tsx}", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

const ID = "(?:BR|FR|NFR|SEC|UI|DAT|IF)";

// Only test and suite titles count, not comments; "DAT-01..05" cites every ID in the range.
const titles = /\b(?:it|test|describe)(?:\.each\([^)]*\))?\(\s*[`"']([^`"']*)[`"']/g;
const cited = new Set<string>();
for (const [file, text] of Object.entries({ ...sources, ...clientSources })) {
	if (file.endsWith("traceability.test.ts")) continue;
	for (const [, title] of text.matchAll(titles)) {
		for (const m of title.matchAll(new RegExp(`\\b(${ID})-(\\d+)(?:\\.\\.(\\d+))?`, "g"))) {
			const [, prefix, from, to] = m;
			for (let n = Number(from); n <= Number(to ?? from); n++)
				cited.add(`${prefix}-${String(n).padStart(2, "0")}`);
		}
	}
}

const rows = [...srs.matchAll(/^\| ((?:BR|FR|NFR|SEC|UI|DAT|IF)-\d+) \|.*\| ([TID, ]+) \|$/gm)].map((m) => ({
	id: m[1],
	methods: m[2],
}));

describe("requirements traceability", () => {
	it("the SRS requirement table was parsed", () => {
		expect(rows.length).toBeGreaterThan(100);
	});

	it("every requirement verified by test (T) is cited by at least one test (NFR-03)", () => {
		const missing = rows.filter((r) => r.methods.includes("T") && !cited.has(r.id)).map((r) => r.id);
		expect(missing).toEqual([]);
	});
});
