import { describe, expect, it } from "vitest";
import { worker } from "./helpers";

// The CSP lives in client/public/_headers and is applied by the static-assets layer, which the
// ASSETS binding goes through too. These tests need client/dist built (`cd client && npm run build`).

async function fetchCsp(path: string) {
	const res = await worker.fetch(`http://localhost${path}`);
	expect(res.status).toBe(200);
	const policy = res.headers.get("content-security-policy");
	expect(policy).not.toBeNull();
	const directives = new Map<string, string[]>();
	for (const part of (policy as string).split(";")) {
		const [name, ...sources] = part.trim().split(/\s+/);
		if (name) directives.set(name, sources);
	}
	return { res, directives };
}

describe("SPA content security policy (SEC-08)", () => {
	it.each(["/", "/docs", "/tenders"])("SEC-08: %s is served with a CSP", async (path) => {
		const { directives } = await fetchCsp(path);
		expect(directives.size).toBeGreaterThan(0);
	});

	it("SEC-08: scripts only from this origin, never inline, eval or third-party", async () => {
		const { directives } = await fetchCsp("/");
		expect(directives.get("script-src")).toEqual(["'self'"]);
		expect(directives.get("default-src")).toEqual(["'self'"]);
		for (const [name, sources] of directives) {
			if (name === "style-src") continue;
			expect(sources).not.toContain("'unsafe-inline'");
			expect(sources).not.toContain("'unsafe-eval'");
			expect(sources.join(" ")).not.toMatch(/https?:|\*/);
		}
	});

	it("SEC-08: no plugins, no base-tag hijack, no framing, requests only to this origin", async () => {
		const { directives } = await fetchCsp("/");
		expect(directives.get("object-src")).toEqual(["'none'"]);
		expect(directives.get("base-uri")).toEqual(["'self'"]);
		expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
		expect(directives.get("connect-src")).toEqual(["'self'"]);
	});

	it("SEC-08: the SPA shell contains no inline script or event-handler attribute", async () => {
		const html = await (await worker.fetch("http://localhost/")).text();
		const inlineScripts = [...html.matchAll(/<script\b([^>]*)>/gi)].filter(
			([, attrs]) => !/\ssrc=/i.test(` ${attrs}`),
		);
		expect(inlineScripts).toEqual([]);
		expect(html).not.toMatch(/\son[a-z]+\s*=/i);
		expect(html).not.toMatch(/javascript:/i);
	});

	it("SEC-08: API responses carry no CSP (it is the SPA shell's policy)", async () => {
		const res = await worker.fetch("http://localhost/api/auth/me");
		expect(res.headers.get("content-security-policy")).toBeNull();
	});
});
