import { beforeAll, describe, expect, it } from "vitest";
import { api, login, postJson, worker } from "./helpers";

type Role = "admin" | "user" | "viewer";

let admin: string;

const PASSWORD = "RolePass12345!";

async function tokenFor(role: Role) {
	const email = `api-docs-${role}-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const created = await postJson("/api/users", { email, password: PASSWORD, role }, admin);
	expect(created.status).toBe(201);
	return login(email, PASSWORD);
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
});

describe("API documentation: spec access (FR-45, SEC-04)", () => {
	it("FR-45: /openapi.json without a session is rejected with 401", async () => {
		const r = await api("/openapi.json");
		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});

	it("FR-45: /openapi.json with an invalid token is rejected with 401", async () => {
		const r = await api("/openapi.json", {}, "not-a-jwt");
		expect(r.status).toBe(401);
	});

	it.each(["admin", "user", "viewer"] as const)(
		"FR-32: /openapi.json serves the spec to a signed-in %s",
		async (role) => {
			const token = role === "admin" ? admin : await tokenFor(role);
			const r = await api("/openapi.json", {}, token);
			expect(r.status).toBe(200);
			expect(r.body.openapi).toMatch(/^3\./);
			expect(r.body.paths["/api/tenders"]).toBeDefined();
		},
	);

	it("SEC-04: the YAML twin of the spec needs a session too", async () => {
		const anonymous = await worker.fetch("http://localhost/openapi.yaml");
		expect(anonymous.status).toBe(401);
		const signedIn = await worker.fetch("http://localhost/openapi.yaml", {
			headers: { Authorization: `Bearer ${admin}` },
		});
		expect(signedIn.status).toBe(200);
		expect(await signedIn.text()).toContain("openapi:");
	});

	it("SEC-04: the spec does not leak through the old /api/openapi.json path", async () => {
		const anonymous = await api("/api/openapi.json");
		expect(anonymous.status).toBe(401);
		const signedIn = await api("/api/openapi.json", {}, admin);
		expect(signedIn.body?.paths).toBeUndefined();
	});
});

describe("API documentation: no interactive pages on the API (FR-45, SEC-04)", () => {
	// A documentation page is what chanfana would render: Swagger UI or ReDoc HTML.
	async function expectNoDocsPage(path: string, token?: string) {
		const headers = new Headers();
		if (token) headers.set("Authorization", `Bearer ${token}`);
		const res = await worker.fetch(`http://localhost${path}`, { headers });
		const text = await res.text();
		expect(text.toLowerCase()).not.toContain("swagger-ui");
		expect(text.toLowerCase()).not.toContain("redoc");
		return res.status;
	}

	it("FR-45: /api/docs never returns a documentation page, signed in or not", async () => {
		expect(await expectNoDocsPage("/api/docs")).toBe(401);
		expect(await expectNoDocsPage("/api/docs", admin)).not.toBe(200);
	});

	it("FR-45: /redocs never returns a documentation page, signed in or not", async () => {
		await expectNoDocsPage("/redocs");
		await expectNoDocsPage("/redocs", admin);
	});

	it("FR-45: /docs on the Worker is not an API-served documentation page", async () => {
		// `/docs` is the SPA route (FR-32); the Worker only ever answers it with the SPA shell.
		await expectNoDocsPage("/docs");
	});
});
