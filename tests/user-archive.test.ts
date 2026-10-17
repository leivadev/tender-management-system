import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/db/client";
import { archiveUser, changeUserRole } from "../src/domain/users/archiving";
import { api, login, patchJson, postJson, withSql } from "./helpers";

type Role = "admin" | "user" | "viewer";
type TestUser = { id: string; email: string; token: string };

let admin: string;

const PASSWORD = "RolePass12345!";

async function createUser(role: Role): Promise<TestUser> {
	const email = `user-archive-${role}-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const created = await postJson("/api/users", { email, password: PASSWORD, role }, admin);
	expect(created.status).toBe(201);
	return { id: created.body.user.id, email, token: await login(email, PASSWORD) };
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
});

const archive = (id: string, token = admin) => postJson(`/api/users/${id}/archive`, {}, token);
const restore = (id: string, token = admin) => postJson(`/api/users/${id}/restore`, {}, token);
const loginStatus = (email: string) =>
	api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: PASSWORD }) });
const adminId = async () => (await api("/api/auth/me", {}, admin)).body.user.id as string;

/** Pages through the users list until the id is found, so the assertion ignores the rest of the table. */
async function listed(id: string, query = "") {
	for (let page = 1; page < 50; page++) {
		const r = await api(`/api/users?page=${page}&pageSize=100${query}`, {}, admin);
		expect(r.status).toBe(200);
		if ((r.body.data as { id: string }[]).some((u) => u.id === id)) return true;
		if (page * 100 >= r.body.total) return false;
	}
	return false;
}

describe("archive and restore users (FR-40, FR-51, DAT-11)", () => {
	it("archive marks the profile with the archiving admin and keeps the data (FR-51)", async () => {
		const target = await createUser("user");
		const me = await adminId();

		const r = await archive(target.id);

		expect(r.status).toBe(200);
		expect(r.body.user.id).toBe(target.id);
		expect(r.body.user.archivedAt).toEqual(expect.any(String));
		expect(r.body.user.archivedBy).toBe(me);
		expect(r.body.user.email).toBe(target.email);
		expect(r.body.user.role).toBe("user");
	});

	it("archive bans the user at the auth provider and revokes their sessions (FR-51, FR-42)", async () => {
		const target = await createUser("user");
		const before = await withSql(
			(q) =>
				q`select count(*)::int as n from auth.refresh_tokens where user_id = ${target.id}::text and not revoked`,
		);
		expect(before[0]?.n).toBeGreaterThan(0);

		expect((await archive(target.id)).status).toBe(200);

		const [banned] = await withSql((q) => q`select banned_until from auth.users where id = ${target.id}`);
		expect(banned?.banned_until).not.toBeNull();
		const after = await withSql(
			(q) =>
				q`select count(*)::int as n from auth.refresh_tokens where user_id = ${target.id}::text and not revoked`,
		);
		expect(after[0]?.n).toBe(0);
		const sessions = await withSql(
			(q) => q`select count(*)::int as n from auth.sessions where user_id = ${target.id}`,
		);
		expect(sessions[0]?.n).toBe(0);
	});

	it("an archived user cannot log in (FR-42)", async () => {
		const target = await createUser("user");
		expect((await loginStatus(target.email)).status).toBe(200);

		await archive(target.id);

		const r = await loginStatus(target.email);
		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});

	it("an archived profile gets 401 UNAUTHENTICATED with a still-valid token (SEC-19)", async () => {
		const target = await createUser("user");
		expect((await api("/api/auth/me", {}, target.token)).status).toBe(200);

		await archive(target.id);

		for (const path of ["/api/auth/me", "/api/tenders", "/api/clients"]) {
			const r = await api(path, {}, target.token);
			expect(r.status).toBe(401);
			expect(r.body.error.code).toBe("UNAUTHENTICATED");
		}
		// Writes too, and even for a role that would normally be refused with 403.
		const write = await postJson(
			"/api/clients",
			{ name: "X", companyName: "X Co", email: "x@example.com" },
			target.token,
		);
		expect(write.status).toBe(401);
	});

	it("an archived admin's still-valid token is also rejected (SEC-19)", async () => {
		const target = await createUser("admin");
		await archive(target.id);

		const r = await api("/api/users", {}, target.token);

		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});

	it("restore lifts the ban, clears the marker and keeps the previous role (FR-51, DAT-11)", async () => {
		const target = await createUser("viewer");
		await archive(target.id);
		const me = await adminId();

		const r = await restore(target.id);

		expect(r.status).toBe(200);
		expect(r.body.user.archivedAt).toBeNull();
		expect(r.body.user.archivedBy).toBeNull();
		expect(r.body.user.updatedBy).toBe(me);
		expect(r.body.user.role).toBe("viewer");
		const again = await loginStatus(target.email);
		expect(again.status).toBe(200);
		const profile = await api("/api/auth/me", {}, again.body.access_token);
		expect(profile.status).toBe(200);
		expect(profile.body.user.role).toBe("viewer");
	});

	it("archiving an unknown user is 404; archiving twice and restoring a live user are 409", async () => {
		const target = await createUser("user");

		expect((await archive(crypto.randomUUID())).status).toBe(404);
		expect((await restore(crypto.randomUUID())).status).toBe(404);
		expect((await restore(target.id)).status).toBe(409);
		expect((await archive(target.id)).status).toBe(200);
		const again = await archive(target.id);
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("CONFLICT");
	});

	it("archive and restore are admin only (FR-40)", async () => {
		const target = await createUser("user");
		const writer = await createUser("user");
		const viewer = await createUser("viewer");

		for (const actor of [writer, viewer]) {
			expect((await archive(target.id, actor.token)).status).toBe(403);
			expect((await restore(target.id, actor.token)).status).toBe(403);
		}
		await archive(target.id);
		expect((await restore(target.id, writer.token)).status).toBe(403);
	});
});

describe("listing archived users (FR-41)", () => {
	it("excludes archived users by default; archived=only|include are honoured for admin", async () => {
		const live = await createUser("user");
		const gone = await createUser("user");
		await archive(gone.id);

		expect(await listed(live.id)).toBe(true);
		expect(await listed(gone.id)).toBe(false);
		expect(await listed(gone.id, "&archived=only")).toBe(true);
		expect(await listed(live.id, "&archived=only")).toBe(false);
		expect(await listed(gone.id, "&archived=include")).toBe(true);
		expect(await listed(live.id, "&archived=include")).toBe(true);
	});
});

describe("self-protection (FR-52)", () => {
	it("an admin cannot archive themselves: 409 CONFLICT and nothing changes", async () => {
		const me = await adminId();

		const r = await archive(me);

		expect(r.status).toBe(409);
		expect(r.body.error.code).toBe("CONFLICT");
		expect((await api("/api/auth/me", {}, admin)).status).toBe(200);
	});

	it("an admin cannot change their own role, not even to the same role: 409 CONFLICT", async () => {
		const me = await createUser("admin");

		for (const role of ["user", "admin"]) {
			const r = await patchJson(`/api/users/${me.id}`, { role }, me.token);
			expect(r.status).toBe(409);
			expect(r.body.error.code).toBe("CONFLICT");
		}
		expect((await api("/api/auth/me", {}, me.token)).body.user.role).toBe("admin");
	});

	it("another admin can change that admin's role", async () => {
		const other = await createUser("admin");

		const r = await patchJson(`/api/users/${other.id}`, { role: "viewer" }, admin);

		expect(r.status).toBe(200);
		expect(r.body.user.role).toBe("viewer");
	});
});

describe("users are edited for role only (FR-33)", () => {
	it("the active flag is gone from the profile and the update body", async () => {
		const target = await createUser("user");

		const r = await patchJson(`/api/users/${target.id}`, { active: false }, admin);
		expect(r.status).toBe(400);

		const updated = await patchJson(`/api/users/${target.id}`, { role: "viewer" }, admin);
		expect(updated.status).toBe(200);
		expect(updated.body.user).not.toHaveProperty("active");
		expect((await api("/api/auth/me", {}, target.token)).status).toBe(200);
	});
});

describe("archived users keep their role until restored (FR-51)", () => {
	it("changing the role of an archived user is 409 and the role survives the restore", async () => {
		const target = await createUser("viewer");
		await archive(target.id);

		const r = await patchJson(`/api/users/${target.id}`, { role: "admin" }, admin);

		expect(r.status).toBe(409);
		expect(r.body.error.code).toBe("CONFLICT");
		expect((await restore(target.id)).body.user.role).toBe("viewer");
	});
});

describe("the last non-archived admin is protected (FR-05)", () => {
	class Rollback extends Error {}

	/**
	 * Runs `body` against a transaction in which every admin except `keep` is archived, then rolls it back.
	 * Shared test data has other admins, so this is how "the only admin" is reproduced without leaving a trace.
	 */
	async function withOnlyAdmin(keep: string, body: (db: ReturnType<typeof getDb>) => Promise<void>) {
		await getDb(env)
			.transaction(async (tx) => {
				await tx.execute(
					sql`update profiles set archived_at = now() where role = 'admin' and archived_at is null and id <> ${keep}`,
				);
				await body(tx as unknown as ReturnType<typeof getDb>);
				throw new Rollback();
			})
			.catch((err) => {
				if (!(err instanceof Rollback)) throw err;
			});
	}

	it("the only remaining admin cannot be demoted: 409 CONFLICT", async () => {
		const last = await createUser("admin");
		const actor = await adminId();

		await withOnlyAdmin(last.id, async (db) => {
			await expect(changeUserRole(db, last.id, "user", actor)).rejects.toMatchObject({
				code: "CONFLICT",
				status: 409,
			});
		});

		expect((await api("/api/auth/me", {}, last.token)).body.user.role).toBe("admin");
	});

	it("the only remaining admin cannot be archived: 409 CONFLICT, and nothing is banned", async () => {
		const last = await createUser("admin");
		const actor = await adminId();

		await withOnlyAdmin(last.id, async (db) => {
			await expect(archiveUser(db, env, last.id, actor)).rejects.toMatchObject({
				code: "CONFLICT",
				status: 409,
			});
		});

		expect((await loginStatus(last.email)).status).toBe(200);
		expect((await api("/api/auth/me", {}, last.token)).status).toBe(200);
	});

	it("with another admin around, an admin can be demoted and archived", async () => {
		const first = await createUser("admin");
		const second = await createUser("admin");

		expect((await patchJson(`/api/users/${first.id}`, { role: "user" }, admin)).status).toBe(200);
		expect((await archive(second.id)).status).toBe(200);
	});

	it("archiving or demoting waits on the lock over all non-archived admin rows", async () => {
		// Plain users as targets, and NO KEY UPDATE (which the actor's FK check tolerates): only the admin-set lock can block.
		const first = await createUser("user");
		const second = await createUser("user");
		let demotion: ReturnType<typeof patchJson> | undefined;
		let archival: ReturnType<typeof archive> | undefined;
		let settled = 0;
		const done = () => {
			settled++;
		};

		await withSql((q) =>
			q.begin(async (tx) => {
				await tx`select id from profiles where role = 'admin' and archived_at is null order by id for no key update`;
				demotion = patchJson(`/api/users/${first.id}`, { role: "viewer" }, admin).finally(done);
				archival = archive(second.id).finally(done);
				await new Promise((r) => setTimeout(r, 500));
				// Without the admin-set lock both requests would already have finished.
				expect(settled).toBe(0);
			}),
		);

		expect((await demotion)?.status).toBe(200);
		expect((await archival)?.status).toBe(200);
	});
});
