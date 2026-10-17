import { beforeAll, describe, expect, it } from "vitest";
import {
	api,
	futureDate,
	login,
	patchJson,
	postJson,
	uniqueName,
	uploadPdf,
	withSql,
	worker,
} from "./helpers";

let admin: string;
let writer: string;
let viewer: string;
let clientId: string;

async function createUserToken(role: "user" | "viewer") {
	const email = `tender-archive-${role}-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const created = await postJson("/api/users", { email, password: "RolePass12345!", role }, admin);
	expect(created.status).toBe(201);
	return login(email, "RolePass12345!");
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	writer = await createUserToken("user");
	viewer = await createUserToken("viewer");
	clientId = await newClient();
});

async function newClient() {
	const r = await postJson(
		"/api/clients",
		{
			name: "Tender Archive Contact",
			companyName: uniqueName("Tender Archive Co"),
			email: "delivered@resend.dev",
		},
		admin,
	);
	expect(r.status).toBe(201);
	return r.body.client.id as string;
}

const adminId = async () => (await api("/api/auth/me", {}, admin)).body.user.id as string;

async function draftTender(forClient = clientId) {
	const r = await postJson(
		"/api/tenders",
		{ clientId: forClient, title: uniqueName("Archive Tender"), maxBudget: 1000, deadline: futureDate() },
		admin,
	);
	expect(r.status).toBe(201);
	return r.body.tender.id as string;
}

const forceStatus = (tenderId: string, status: string) =>
	withSql((sql) => sql`update tenders set status = ${status}::tender_status where id = ${tenderId}`);

const archive = (id: string, token = admin) => postJson(`/api/tenders/${id}/archive`, {}, token);
const restore = (id: string, token = admin) => postJson(`/api/tenders/${id}/restore`, {}, token);

/** Search by the unique title so the assertion is independent of the rest of the table. */
const listIds = async (title: string, query = "", token = admin) => {
	const r = await api(`/api/tenders?q=${encodeURIComponent(title)}${query}`, {}, token);
	expect(r.status).toBe(200);
	return (r.body.data as { id: string }[]).map((t) => t.id);
};

const titleOf = async (id: string) =>
	(await api(`/api/tenders/${id}`, {}, admin)).body.tender.title as string;

describe("archive and restore tenders (FR-44)", () => {
	it.each(["draft", "collected", "lost"])(
		"a %s tender can be archived; status and history are unchanged",
		async (status) => {
			const id = await draftTender();
			if (status !== "draft") await forceStatus(id, status);
			const before = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
			const me = await adminId();

			const r = await archive(id);

			expect(r.status).toBe(200);
			expect(r.body.tender.archivedAt).toEqual(expect.any(String));
			expect(r.body.tender.archivedBy).toBe(me);
			const after = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
			expect(after.status).toBe(status);
			expect(after.history).toEqual(before.history);
		},
	);

	it.each(["active", "finalized", "for_collection"])("a %s tender cannot be archived", async (status) => {
		const id = await draftTender();
		await forceStatus(id, status);

		const r = await archive(id);

		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
		const row = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
		expect(row.archivedAt).toBeNull();
	});

	it("restore clears the marker and records the restorer as last modifier", async () => {
		const id = await draftTender();
		await archive(id);

		const r = await restore(id);

		expect(r.status).toBe(200);
		expect(r.body.tender.archivedAt).toBeNull();
		expect(r.body.tender.archivedBy).toBeNull();
		expect(r.body.tender.updatedBy).toBe(await adminId());
		expect(r.body.tender.status).toBe("draft");
	});

	it("unknown tender is 404; archiving twice and restoring a live tender are 409", async () => {
		const unknown = crypto.randomUUID();
		expect((await archive(unknown)).status).toBe(404);
		expect((await restore(unknown)).status).toBe(404);

		const id = await draftTender();
		expect((await restore(id)).status).toBe(409);
		expect((await archive(id)).status).toBe(200);
		const again = await archive(id);
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("CONFLICT");
	});

	it("only an admin may archive or restore: user and viewer get 403", async () => {
		const id = await draftTender();
		for (const token of [writer, viewer]) {
			expect((await archive(id, token)).status).toBe(403);
		}
		await archive(id);
		for (const token of [writer, viewer]) {
			expect((await restore(id, token)).status).toBe(403);
		}
		expect((await api(`/api/tenders/${id}/archive`, { method: "POST" })).status).toBe(401);
	});
});

describe("archived tenders in lists (FR-41)", () => {
	it("hidden by default; admin sees them with archived=only|include; other roles never", async () => {
		const live = await draftTender();
		const gone = await draftTender();
		await archive(gone);
		const liveTitle = await titleOf(live);
		const goneTitle = await titleOf(gone);

		expect(await listIds(goneTitle)).toEqual([]);
		expect(await listIds(goneTitle, "&archived=only")).toEqual([gone]);
		expect(await listIds(goneTitle, "&archived=include")).toEqual([gone]);
		expect(await listIds(liveTitle, "&archived=only")).toEqual([]);
		expect(await listIds(liveTitle, "&archived=include")).toEqual([live]);

		for (const token of [writer, viewer]) {
			expect(await listIds(goneTitle, "&archived=only", token)).toEqual([]);
			expect(await listIds(goneTitle, "&archived=include", token)).toEqual([]);
		}
	});

	it("an archived tender stays readable by id and reappears after restore", async () => {
		const id = await draftTender();
		await archive(id);
		const title = await titleOf(id);

		const detail = await api(`/api/tenders/${id}`, {}, writer);
		expect(detail.status).toBe(200);
		expect(detail.body.tender.archivedAt).toEqual(expect.any(String));

		await restore(id);
		expect(await listIds(title)).toEqual([id]);
	});
});

describe("archived tenders are read-only (FR-47)", () => {
	it("every modifying operation returns 409 except restore", async () => {
		const id = await draftTender();
		const product = await postJson(
			"/api/products",
			{ name: uniqueName("Archive Line"), unitPrice: 10 },
			admin,
		);
		const productId = product.body.product.id as string;
		const line = await postJson(`/api/tenders/${id}/products`, { productId, quantity: 1 }, admin);
		expect(line.status).toBe(201);
		expect((await archive(id)).status).toBe(200);

		const attempts = [
			await patchJson(`/api/tenders/${id}`, { title: "Edited" }, admin),
			await postJson(`/api/tenders/${id}/products`, { productId, quantity: 2 }, admin),
			await api(`/api/tenders/${id}/products/${productId}`, { method: "DELETE" }, admin),
			await uploadPdf(id, admin),
			await postJson(`/api/tenders/${id}/send`, {}, admin),
			await postJson(`/api/tenders/${id}/finalize`, {}, admin),
			await postJson(`/api/tenders/${id}/lost`, {}, admin),
			await postJson(`/api/tenders/${id}/invoice`, { invoiceAmount: 10 }, admin),
			await patchJson(`/api/tenders/${id}/invoice`, { invoiceAmount: 10 }, admin),
			await postJson(`/api/tenders/${id}/payments`, { amount: 10 }, admin),
		];

		for (const r of attempts) {
			expect(r.status).toBe(409);
			expect(r.body.error.code).toBe("CONFLICT");
		}
		const row = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
		expect(row.title).not.toBe("Edited");
		expect(row.products).toHaveLength(1);
		expect(row.status).toBe("draft");
	});

	it("after restore the tender is editable again", async () => {
		const id = await draftTender();
		await archive(id);
		await restore(id);

		const r = await patchJson(`/api/tenders/${id}`, { title: "Edited after restore" }, admin);

		expect(r.status).toBe(200);
		expect(r.body.tender.title).toBe("Edited after restore");
	});
});

describe("clients and proposals of archived tenders", () => {
	it("restoring a tender whose client is archived works; the client stays archived (FR-53)", async () => {
		const ownClient = await newClient();
		const id = await draftTender(ownClient);
		await archive(id);
		expect((await postJson(`/api/clients/${ownClient}/archive`, {}, admin)).status).toBe(200);

		const r = await restore(id);

		expect(r.status).toBe(200);
		expect(r.body.tender.archivedAt).toBeNull();
		const clients = await api(`/api/clients?archived=only`, {}, admin);
		expect((clients.body.data as { id: string }[]).map((c) => c.id)).toContain(ownClient);
	});

	it("the proposal of an archived tender is kept and still downloadable (FR-54)", async () => {
		const id = await draftTender();
		expect((await uploadPdf(id, admin)).status).toBe(200);
		const before = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
		expect(before.proposalKey).toEqual(expect.any(String));

		await archive(id);

		const after = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
		expect(after.proposalKey).toBe(before.proposalKey);
		expect(after.proposalFilename).toBe(before.proposalFilename);
		const download = await worker.fetch(`http://localhost/api/tenders/${id}/proposal/download`, {
			headers: { Authorization: `Bearer ${admin}` },
		});
		expect(download.status).toBe(200);
		expect((await download.text()).startsWith("%PDF-")).toBe(true);

		await restore(id);
		const restored = (await api(`/api/tenders/${id}`, {}, admin)).body.tender;
		expect(restored.proposalKey).toBe(before.proposalKey);
	});
});

describe("dashboard window and archived exclusion (FR-31)", () => {
	const dashboard = (query = "") => api(`/api/dashboard${query}`, {}, admin);

	it.each(["0", "721", "-5", "abc"])("withinHours=%s is VALIDATION_ERROR", async (value) => {
		const r = await dashboard(`?withinHours=${value}`);
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
	});

	it.each(["1", "72", "720"])("withinHours=%s is accepted", async (value) => {
		expect((await dashboard(`?withinHours=${value}`)).status).toBe(200);
	});

	it("defaults to 72 hours", async () => {
		const id = await draftTender();
		await forceStatus(id, "active");
		await withSql(
			(sql) => sql`update tenders set deadline = ${new Date(Date.now() + 60 * 3600 * 1000)} where id = ${id}`,
		);
		const inside = (await dashboard()).body.upcoming as { id: string }[];
		expect(inside.map((t) => t.id)).toContain(id);

		await withSql(
			(sql) => sql`update tenders set deadline = ${new Date(Date.now() + 80 * 3600 * 1000)} where id = ${id}`,
		);
		const outside = (await dashboard()).body.upcoming as { id: string }[];
		expect(outside.map((t) => t.id)).not.toContain(id);
		expect((await dashboard("?withinHours=96")).body.upcoming.map((t: { id: string }) => t.id)).toContain(id);
	});

	it("counts and totals exclude archived tenders and move back on restore", async () => {
		// Test files run in parallel and keep creating drafts, so one sample can be swamped by
		// unrelated inserts; the exclusion must show up in at least one of a few attempts.
		let observed = false;
		for (let attempt = 0; attempt < 5 && !observed; attempt++) {
			const id = await draftTender();
			const base = (await dashboard()).body;
			await archive(id);
			const hidden = (await dashboard()).body;
			await restore(id);
			const shown = (await dashboard()).body;
			observed =
				hidden.counts.draft < base.counts.draft &&
				hidden.total < base.total &&
				shown.counts.draft > hidden.counts.draft &&
				shown.total > hidden.total;
		}
		expect(observed).toBe(true);
	});

	it("the upcoming list never contains an archived tender", async () => {
		const id = await draftTender();
		await archive(id);
		// A raw update stands in for any path that could leave an archived tender active.
		await withSql(
			(sql) =>
				sql`update tenders set status = 'active', deadline = ${new Date(Date.now() + 3600 * 1000)} where id = ${id}`,
		);

		const upcoming = (await dashboard()).body.upcoming as { id: string }[];

		expect(upcoming.map((t) => t.id)).not.toContain(id);

		// Undo the raw update: left active, the row would reach the expiry cron once its deadline passes.
		await withSql((sql) => sql`update tenders set status = 'draft' where id = ${id}`);
	});
});
