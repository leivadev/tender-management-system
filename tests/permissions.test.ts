import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { api, futureDate, login, postJson, uniqueName, worker } from "./helpers";

type Role = "admin" | "user" | "viewer";
const ROLES: Role[] = ["admin", "user", "viewer"];
const PASSWORD = "RolePass12345!";

type Fixtures = { tenderId: string; clientId: string; userId: string };
type Cell = {
	/** SRS 3.4 resource and operation */
	label: string;
	method: string;
	/** Route template as it appears in the OpenAPI spec */
	route: string;
	/** Roles for which the SRS matrix says `Y` */
	allowed: Role[];
	body?: (f: Fixtures) => unknown;
	/** Exact status expected for a permitted role, where the fixture makes it deterministic */
	ok?: number;
	/** Target an id that exists nowhere, so a permitted request cannot change a shared fixture */
	unknownId?: true;
	/** Send a multipart form with a non-PDF file instead of JSON */
	multipart?: true;
};

const ALL = ROLES;
const WRITERS: Role[] = ["admin", "user"];
const ADMIN: Role[] = ["admin"];

// One entry per row of SRS section 3.4. Permitted cells use a body that fails validation or an
// unknown id, so the request proves it got past authorization without changing shared fixtures.
const MATRIX: Cell[] = [
	{ label: "Auth: current user", method: "GET", route: "/api/auth/me", allowed: ALL, ok: 200 },
	{ label: "Users: list", method: "GET", route: "/api/users", allowed: ADMIN, ok: 200 },
	{ label: "Users: create", method: "POST", route: "/api/users", allowed: ADMIN, body: () => ({}) },
	{
		label: "Users: edit",
		method: "PATCH",
		route: "/api/users/{id}",
		allowed: ADMIN,
		body: () => ({ role: "nope" }),
	},
	{
		label: "Users: archive",
		method: "POST",
		route: "/api/users/{id}/archive",
		allowed: ADMIN,
		unknownId: true,
		ok: 404,
	},
	{
		label: "Users: restore",
		method: "POST",
		route: "/api/users/{id}/restore",
		allowed: ADMIN,
		unknownId: true,
		ok: 404,
	},
	{ label: "Clients: list", method: "GET", route: "/api/clients", allowed: ALL, ok: 200 },
	{ label: "Clients: create", method: "POST", route: "/api/clients", allowed: WRITERS, body: () => ({}) },
	{
		label: "Clients: edit",
		method: "PATCH",
		route: "/api/clients/{id}",
		allowed: WRITERS,
		body: () => ({ email: "x" }),
	},
	{
		label: "Clients: archive",
		method: "POST",
		route: "/api/clients/{id}/archive",
		allowed: ADMIN,
		unknownId: true,
		ok: 404,
	},
	{
		label: "Clients: restore",
		method: "POST",
		route: "/api/clients/{id}/restore",
		allowed: ADMIN,
		unknownId: true,
		ok: 404,
	},
	{ label: "Products: list", method: "GET", route: "/api/products", allowed: ALL, ok: 200 },
	{ label: "Products: create", method: "POST", route: "/api/products", allowed: ADMIN, body: () => ({}) },
	{
		label: "Products: edit",
		method: "PATCH",
		route: "/api/products/{id}",
		allowed: ADMIN,
		body: () => ({ name: "" }),
	},
	{ label: "Tenders: list", method: "GET", route: "/api/tenders", allowed: ALL, ok: 200 },
	{ label: "Tenders: detail", method: "GET", route: "/api/tenders/{id}", allowed: ALL, ok: 200 },
	{ label: "Tenders: history", method: "GET", route: "/api/tenders/{id}/history", allowed: ALL, ok: 200 },
	{
		label: "Tenders: list payments",
		method: "GET",
		route: "/api/tenders/{id}/payments",
		allowed: ALL,
		ok: 200,
	},
	{
		label: "Tenders: download proposal",
		method: "GET",
		route: "/api/tenders/{id}/proposal/download",
		allowed: ALL,
		ok: 404, // the fixture tender has no proposal: reaching the handler is what matters
	},
	{ label: "Tenders: create", method: "POST", route: "/api/tenders", allowed: WRITERS, body: () => ({}) },
	{
		label: "Tenders: edit",
		method: "PATCH",
		route: "/api/tenders/{id}",
		allowed: WRITERS,
		body: () => ({ title: "" }),
	},
	{
		label: "Tenders: add product",
		method: "POST",
		route: "/api/tenders/{id}/products",
		allowed: WRITERS,
		body: () => ({}),
	},
	{
		label: "Tenders: remove product",
		method: "DELETE",
		route: "/api/tenders/{id}/products/{productId}",
		allowed: WRITERS,
		ok: 200, // removing a product the tender does not hold is a no-op
	},
	{
		label: "Tenders: upload proposal",
		method: "POST",
		route: "/api/tenders/{id}/proposal",
		allowed: WRITERS,
		multipart: true,
		ok: 400,
	},
	{ label: "Tenders: send", method: "POST", route: "/api/tenders/{id}/send", allowed: WRITERS, ok: 422 },
	{
		label: "Tenders: finalize",
		method: "POST",
		route: "/api/tenders/{id}/finalize",
		allowed: WRITERS,
		ok: 422,
	},
	{
		label: "Tenders: archive",
		method: "POST",
		route: "/api/tenders/{id}/archive",
		allowed: ADMIN,
		unknownId: true,
		ok: 404,
	},
	{
		label: "Tenders: restore",
		method: "POST",
		route: "/api/tenders/{id}/restore",
		allowed: ADMIN,
		unknownId: true,
		ok: 404,
	},
	{ label: "Tenders: mark lost", method: "POST", route: "/api/tenders/{id}/lost", allowed: ADMIN, ok: 422 },
	{
		label: "Tenders: invoice",
		method: "POST",
		route: "/api/tenders/{id}/invoice",
		allowed: ADMIN,
		body: () => ({}),
	},
	{
		label: "Tenders: correct invoiced amount",
		method: "PATCH",
		route: "/api/tenders/{id}/invoice",
		allowed: ADMIN,
		body: () => ({}),
	},
	{
		label: "Payments: register",
		method: "POST",
		route: "/api/tenders/{id}/payments",
		allowed: ADMIN,
		body: () => ({}),
	},
	{ label: "Dashboard: summary", method: "GET", route: "/api/dashboard", allowed: ALL, ok: 200 },
	{ label: "Dashboard: metrics", method: "GET", route: "/api/dashboard/metrics", allowed: ALL, ok: 200 },
];

// Logging out revokes every session of the user, so it gets throwaway users.
const LOGOUT = { label: "Auth: logout", method: "POST", route: "/api/auth/logout" };

const tokens = {} as Record<Role, string>;
let fixtures: Fixtures;
let spec: { paths: Record<string, Record<string, unknown>> };

async function createUserWithToken(role: Role) {
	const email = `permissions-${role}-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const admin = tokens.admin ?? (await login("admin@example.com", "AdminPass123!"));
	const created = await postJson("/api/users", { email, password: PASSWORD, role }, admin);
	expect(created.status).toBe(201);
	return { id: created.body.user.id as string, token: await login(email, PASSWORD) };
}

/** A multipart request the handler rejects as not-a-PDF, so nothing is stored. */
async function upload(path: string, token?: string) {
	const form = new FormData();
	form.append("file", new Blob(["not a pdf"], { type: "text/plain" }), "notes.txt");
	const res = await worker.fetch(`http://localhost${path}`, {
		method: "POST",
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: form,
	});
	return { status: res.status, body: await res.json().catch(() => null) };
}

function resolveRoute(cell: Pick<Cell, "route" | "unknownId">, f: Fixtures) {
	const fixtureId = cell.route.startsWith("/api/users")
		? f.userId
		: cell.route.startsWith("/api/clients")
			? f.clientId
			: f.tenderId;
	return cell.route
		.replace("{productId}", crypto.randomUUID())
		.replace("{id}", cell.unknownId ? crypto.randomUUID() : fixtureId);
}

function call(
	cell: Pick<Cell, "method" | "route" | "unknownId" | "multipart"> & { body?: Cell["body"] },
	token?: string,
) {
	const path = resolveRoute(cell, fixtures);
	if (cell.multipart) return upload(path, token);
	const init: RequestInit = { method: cell.method };
	if (cell.body) init.body = JSON.stringify(cell.body(fixtures));
	else if (cell.method !== "GET" && cell.method !== "DELETE") init.body = "{}";
	return api(path, init, token);
}

beforeAll(async () => {
	tokens.admin = await login("admin@example.com", "AdminPass123!");
	tokens.user = (await createUserWithToken("user")).token;
	tokens.viewer = (await createUserWithToken("viewer")).token;

	const client = await postJson(
		"/api/clients",
		{ name: "Permissions Contact", companyName: uniqueName("Permissions Co"), email: "delivered@resend.dev" },
		tokens.admin,
	);
	const tender = await postJson(
		"/api/tenders",
		{
			clientId: client.body.client.id,
			title: uniqueName("Permissions"),
			maxBudget: 1000,
			deadline: futureDate(),
		},
		tokens.admin,
	);
	const other = await createUserWithToken("viewer");
	fixtures = {
		tenderId: tender.body.tender.id,
		clientId: client.body.client.id,
		userId: other.id,
	};

	const res = await api("/openapi.json", {}, tokens.admin);
	spec = res.body;
});

describe("permission matrix (SEC-01, SRS 3.4)", () => {
	const cases = MATRIX.flatMap((cell) => ROLES.map((role) => ({ cell, role })));

	it.each(cases)("SEC-01: $cell.label as $role - $cell.method $cell.route", async ({ cell, role }) => {
		const r = await call(cell, tokens[role]);

		if (cell.allowed.includes(role)) {
			expect(r.status, JSON.stringify(r.body)).not.toBe(403);
			expect(r.status).not.toBe(401);
			expect(r.status, JSON.stringify(r.body)).toBeLessThan(500);
			if (cell.ok) expect(r.status, JSON.stringify(r.body)).toBe(cell.ok);
		} else {
			expect(r.status).toBe(403);
			expect(r.body.error.code).toBe("FORBIDDEN");
		}
	});

	it.each(ROLES)("SEC-01: Auth: logout as %s is permitted", async (role) => {
		const { token } = await createUserWithToken(role);

		const r = await call(LOGOUT, token);

		expect(r.status).toBe(200);
	});

	it.each(ROLES)("SEC-01: API documentation: view as %s is permitted", async (role) => {
		const r = await api("/openapi.json", {}, tokens[role]);

		expect(r.status).toBe(200);
	});

	it("SEC-01: every /api route in the OpenAPI spec has a matrix entry", () => {
		const covered = new Set([...MATRIX, LOGOUT].map((c) => `${c.method} ${c.route}`));
		const published = Object.entries(spec.paths)
			.filter(([path]) => path.startsWith("/api/") && path !== "/api/auth/login")
			.flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`));

		expect(published.filter((route) => !covered.has(route))).toEqual([]);
		expect([...covered].filter((route) => !published.includes(route))).toEqual([]);
	});

	it("FR-04: the user list is restricted to admin", async () => {
		expect((await api("/api/users", {}, tokens.admin)).status).toBe(200);
		for (const role of ["user", "viewer"] as const) {
			const r = await api("/api/users", {}, tokens[role]);
			expect(r.status).toBe(403);
			expect(r.body.error.code).toBe("FORBIDDEN");
		}
	});
});

describe("requests without a session (SEC-01)", () => {
	const routes = () =>
		Object.entries(spec.paths)
			.filter(([path]) => path.startsWith("/api/") && path !== "/api/auth/login")
			.flatMap(([path, ops]) =>
				Object.keys(ops).map((method) => ({ method: method.toUpperCase(), route: path })),
			);

	it("SEC-01: every route except login answers 401 UNAUTHENTICATED without a token", async () => {
		const failures: string[] = [];
		for (const { method, route } of routes()) {
			const r = await call({ method, route });
			if (r.status !== 401 || r.body?.error?.code !== "UNAUTHENTICATED")
				failures.push(`${method} ${route} → ${r.status}`);
		}

		expect(failures).toEqual([]);
	});

	it("SEC-01: login stays reachable without a session", async () => {
		const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({}) });

		expect(r.status).toBe(400);
	});

	it("SEC-01: unknown /api paths and wrong methods still need a session", async () => {
		expect((await api("/api/does-not-exist")).status).toBe(401);
		expect((await api("/api/tenders", { method: "DELETE" })).status).toBe(401);
	});
});

describe("JWT verification fails closed (SEC-02)", () => {
	const b64url = (value: string) => btoa(value).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
	const parts = (jwt: string) => jwt.split(".");
	const claimsOf = (jwt: string) => JSON.parse(atob(parts(jwt)[1].replace(/-/g, "+").replace(/_/g, "/")));
	const headerOf = (jwt: string) => JSON.parse(atob(parts(jwt)[0].replace(/-/g, "+").replace(/_/g, "/")));

	async function expectDenied(token: string) {
		const r = await api("/api/tenders", {}, token);
		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	}

	it("SEC-02: a valid admin token is accepted (control)", async () => {
		expect((await api("/api/tenders", {}, tokens.admin)).status).toBe(200);
	});

	it("SEC-02: a token that is not a JWT is denied", async () => {
		await expectDenied("not-a-jwt");
	});

	it("SEC-02: an empty or missing bearer value is denied", async () => {
		const empty = await worker.fetch("http://localhost/api/tenders", {
			headers: { Authorization: "Bearer " },
		});
		expect(empty.status).toBe(401);
		const basic = await worker.fetch("http://localhost/api/tenders", {
			headers: { Authorization: "Basic YTpi" },
		});
		expect(basic.status).toBe(401);
	});

	it("SEC-02: a token whose payload was tampered with keeps its signature and is denied", async () => {
		const [h, , s] = parts(tokens.admin);
		const claims = {
			...claimsOf(tokens.admin),
			role: "service_role",
			exp: Math.floor(Date.now() / 1000) + 86400,
		};

		await expectDenied(`${h}.${b64url(JSON.stringify(claims))}.${s}`);
	});

	it("SEC-02: a token for another user's subject with the admin signature is denied", async () => {
		const [h, , s] = parts(tokens.admin);
		const claims = { ...claimsOf(tokens.admin), sub: crypto.randomUUID() };

		await expectDenied(`${h}.${b64url(JSON.stringify(claims))}.${s}`);
	});

	it("SEC-02, IF-02: an unsigned token (alg none) is denied", async () => {
		const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
		const payload = b64url(JSON.stringify(claimsOf(tokens.admin)));

		await expectDenied(`${header}.${payload}.`);
	});

	it("SEC-02: a token signed with a secret the provider does not hold is denied", async () => {
		const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
		const payload = b64url(JSON.stringify(claimsOf(tokens.admin)));
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode("an-attacker-chosen-secret-of-32-bytes!!"),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = new Uint8Array(
			await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)),
		);
		const signature = b64url(String.fromCharCode(...sig));

		await expectDenied(`${header}.${payload}.${signature}`);
	});

	it("SEC-02: a token whose key id is not in the provider key set cannot be verified and is denied", async () => {
		const [, p, s] = parts(tokens.admin);
		const header = b64url(JSON.stringify({ ...headerOf(tokens.admin), kid: crypto.randomUUID() }));

		await expectDenied(`${header}.${p}.${s}`);
	});

	it("SEC-02: the provider's public key is not accepted as a user token", async () => {
		const r = await api("/api/tenders", {}, env.SUPABASE_PUBLISHABLE_KEY);

		expect(r.status).toBe(401);
	});

	it("SEC-02: a signed-in token for a user with no profile is denied", async () => {
		// The auth user exists at the provider, but the application never created its profile.
		const email = `permissions-orphan-${crypto.randomUUID().slice(0, 8)}@example.com`;
		const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
			method: "POST",
			headers: { apikey: env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
		});
		expect(created.status).toBe(200);
		const { id } = (await created.json()) as { id: string };
		const signIn = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
			method: "POST",
			headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: PASSWORD }),
		});
		const { access_token } = (await signIn.json()) as { access_token: string };
		try {
			const r = await api("/api/tenders", {}, access_token);

			expect(r.status).toBe(403);
		} finally {
			await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${id}`, {
				method: "DELETE",
				headers: { apikey: env.SUPABASE_SECRET_KEY },
			});
		}
	});
});
