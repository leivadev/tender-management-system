import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, login, patchJson, postJson, withSql } from "./helpers";

type AuthRequest = { path: string; headers: Record<string, string> };

const authStub = (globalThis as unknown as { __authStub: { rateLimit: boolean; logoutFails: boolean } })
	.__authStub;
const authRequests = (globalThis as unknown as { __authRequests: AuthRequest[] }).__authRequests;

const PASSWORD = "HardenPass123!";
let admin: string;

const loginRequest = (email: string, password: string, headers: Record<string, string> = {}) =>
	api("/api/auth/login", { method: "POST", headers, body: JSON.stringify({ email, password }) });

const sessionIdOf = (jwt: string) => JSON.parse(atob(jwt.split(".")[1])).session_id as string;

async function createUser(role: "user" | "viewer" = "user") {
	const email = `harden-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const created = await postJson("/api/users", { email, password: PASSWORD, role }, admin);
	expect(created.status).toBe(201);
	return { id: created.body.user.id as string, email };
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
});

beforeEach(() => {
	authStub.rateLimit = false;
	authStub.logoutFails = false;
	authRequests.length = 0;
});

describe("login rate limiting (FR-06)", () => {
	it("forwards the end-user IP to the provider so limits apply per end user", async () => {
		const r = await loginRequest("admin@example.com", "AdminPass123!", { "CF-Connecting-IP": "203.0.113.7" });

		expect(r.status).toBe(200);
		const tokenCall = authRequests.find((c) => c.path === "/auth/v1/token");
		expect(tokenCall?.headers["sb-forwarded-for"]).toBe("203.0.113.7");
	});

	it("sends no forwarded IP when the request carries none", async () => {
		await loginRequest("admin@example.com", "AdminPass123!");

		const tokenCall = authRequests.find((c) => c.path === "/auth/v1/token");
		expect(tokenCall?.headers["sb-forwarded-for"]).toBeUndefined();
	});

	it("maps a provider 429 to 429 RATE_LIMITED", async () => {
		authStub.rateLimit = true;

		const r = await loginRequest("admin@example.com", "AdminPass123!", { "CF-Connecting-IP": "203.0.113.8" });

		expect(r.status).toBe(429);
		expect(r.body.error.code).toBe("RATE_LIMITED");
	});

	it("a wrong password is still 401, not RATE_LIMITED", async () => {
		const r = await loginRequest("admin@example.com", "not-the-password");

		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});
});

describe("logout (FR-02)", () => {
	it("ends the session at the provider and revokes its refresh tokens", async () => {
		const user = await createUser();
		const token = await login(user.email, PASSWORD);
		const sessionId = sessionIdOf(token);
		const sessionsBefore = await withSql(
			(sql) => sql`select count(*)::int as n from auth.sessions where user_id = ${user.id}`,
		);
		expect(sessionsBefore[0].n).toBeGreaterThan(0);

		const r = await api("/api/auth/logout", { method: "POST" }, token);

		expect(r.status).toBe(200);
		expect(authRequests.some((c) => c.path === "/auth/v1/logout")).toBe(true);
		const sessions = await withSql((sql) => sql`select id from auth.sessions where user_id = ${user.id}`);
		expect(sessions.map((s) => s.id)).not.toContain(sessionId);
		const live = await withSql(
			(sql) =>
				sql`select count(*)::int as n from auth.refresh_tokens where user_id = ${user.id}::text and not revoked`,
		);
		expect(live[0].n).toBe(0);
	});

	it("signs out every session of the user (global scope)", async () => {
		const user = await createUser();
		const first = await login(user.email, PASSWORD);
		const second = await login(user.email, PASSWORD);

		expect((await api("/api/auth/logout", { method: "POST" }, first)).status).toBe(200);

		const sessions = await withSql((sql) => sql`select id from auth.sessions where user_id = ${user.id}`);
		expect(sessions.map((s) => s.id)).not.toContain(sessionIdOf(second));
	});

	it("does not report success when the provider sign-out fails", async () => {
		const token = await login("admin@example.com", "AdminPass123!");
		authStub.logoutFails = true;

		const r = await api("/api/auth/logout", { method: "POST" }, token);

		expect(r.status).toBe(500);
		expect(r.body.error.code).toBe("INTERNAL_ERROR");
	});
});

describe("provider settings (SEC-17, SEC-20)", () => {
	it("issues access tokens that live 3600 seconds (SEC-17)", async () => {
		const before = Math.floor(Date.now() / 1000);
		const r = await loginRequest("admin@example.com", "AdminPass123!");

		expect(r.status).toBe(200);
		expect(r.body.expires_at - before).toBeGreaterThanOrEqual(3590);
		expect(r.body.expires_at - before).toBeLessThanOrEqual(3610);
	});

	it("the provider rejects passwords shorter than 12 characters (SEC-20)", async () => {
		const user = await createUser();
		const token = await login(user.email, PASSWORD);

		const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
			method: "PUT",
			headers: {
				apikey: env.SUPABASE_PUBLISHABLE_KEY,
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ password: "Short12345!" }),
		});

		expect(res.status).toBe(422);
		expect(((await res.json()) as { error_code: string }).error_code).toBe("weak_password");
	});

	it("the API rejects a password shorter than 12 characters naming the field (SEC-20)", async () => {
		const r = await postJson(
			"/api/users",
			{
				email: `short-${crypto.randomUUID().slice(0, 8)}@example.com`,
				password: "Short12345!",
				role: "user",
			},
			admin,
		);

		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
		expect(r.body.error.message).toContain("password");
	});

	it("accepts a 12-character password with no composition rules (SEC-20)", async () => {
		const email = `plain-${crypto.randomUUID().slice(0, 8)}@example.com`;

		const r = await postJson("/api/users", { email, password: "alllowercase", role: "user" }, admin);

		expect(r.status).toBe(201);
		expect(await login(email, "alllowercase")).toEqual(expect.any(String));
	});
});

describe("passwords are set once by an admin (FR-03)", () => {
	it("a user's password cannot be changed through the user update endpoint", async () => {
		const user = await createUser();

		const r = await patchJson(`/api/users/${user.id}`, { password: "ChangedPass123!" }, admin);

		expect(r.status).toBe(400);
		expect((await loginRequest(user.email, PASSWORD)).status).toBe(200);
		expect((await loginRequest(user.email, "ChangedPass123!")).status).toBe(401);
	});

	it.each([
		["POST", "/api/auth/password"],
		["PUT", "/api/auth/password"],
		["POST", "/api/auth/recover"],
		["POST", "/api/auth/reset-password"],
		["POST", "/api/auth/forgot-password"],
		["PUT", "/api/users/00000000-0000-4000-8000-000000000000/password"],
		["POST", "/api/users/00000000-0000-4000-8000-000000000000/password"],
		["POST", "/api/users/00000000-0000-4000-8000-000000000000/reset-password"],
	])("%s %s does not exist", async (method, path) => {
		const r = await api(path, { method, body: JSON.stringify({ password: "ChangedPass123!" }) }, admin);

		expect(r.status).toBe(404);
	});

	it("the OpenAPI spec exposes no password-changing or recovery operation", async () => {
		const { body: spec } = await api("/openapi.json", {}, admin);

		const operations = Object.keys(spec.paths).filter((p) => /password|recover|reset/i.test(p));
		expect(operations).toEqual([]);
	});
});
