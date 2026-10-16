import { beforeAll, describe, expect, it } from "vitest";
import { api, futureDate, login, postJson, uniqueName, uploadPdf, withSql } from "./helpers";

let admin: string;
let writer: string;
let viewer: string;

async function createUserToken(role: "user" | "viewer") {
	const email = `client-archive-${role}-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const created = await postJson("/api/users", { email, password: "RolePass12345!", role }, admin);
	expect(created.status).toBe(201);
	return login(email, "RolePass12345!");
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	writer = await createUserToken("user");
	viewer = await createUserToken("viewer");
});

const adminId = async () => (await api("/api/auth/me", {}, admin)).body.user.id as string;

async function newClient() {
	const r = await postJson(
		"/api/clients",
		{ name: "Archive Contact", companyName: uniqueName("Archive Co"), email: "delivered@resend.dev" },
		admin,
	);
	expect(r.status).toBe(201);
	return r.body.client as { id: string; companyName: string };
}

const archive = (id: string, token = admin) => postJson(`/api/clients/${id}/archive`, {}, token);
const restore = (id: string, token = admin) => postJson(`/api/clients/${id}/restore`, {}, token);
const createTender = (clientId: string, token = admin) =>
	postJson(
		"/api/tenders",
		{ clientId, title: "Archive Tender", maxBudget: 1000, deadline: futureDate() },
		token,
	);

/** Search by the unique company name so the assertion is independent of the rest of the table. */
const listIds = async (company: string, query = "", token = admin) => {
	const r = await api(`/api/clients?q=${encodeURIComponent(company)}${query}`, {}, token);
	expect(r.status).toBe(200);
	return (r.body.data as { id: string }[]).map((c) => c.id);
};

/** Moves a draft tender to the given status directly, the way the other states are not reachable cheaply. */
const forceStatus = (tenderId: string, status: string) =>
	withSql((sql) => sql`update tenders set status = ${status}::tender_status where id = ${tenderId}`);

describe("archive and restore clients (FR-40, DAT-11)", () => {
	it("archive stores the marker and the archiving admin; data is kept", async () => {
		const client = await newClient();
		const me = await adminId();

		const r = await archive(client.id);

		expect(r.status).toBe(200);
		expect(r.body.client.id).toBe(client.id);
		expect(r.body.client.archivedAt).toEqual(expect.any(String));
		expect(r.body.client.archivedBy).toBe(me);
		expect(r.body.client.companyName).toBe(client.companyName);
	});

	it("restore clears the marker and records the restorer as last modifier", async () => {
		const client = await newClient();
		await archive(client.id);

		const r = await restore(client.id);

		expect(r.status).toBe(200);
		expect(r.body.client.archivedAt).toBeNull();
		expect(r.body.client.archivedBy).toBeNull();
		const me = await adminId();
		expect(r.body.client.updatedBy).toBe(me);
	});

	it("archiving an unknown client is 404, archiving twice and restoring a live client are 409", async () => {
		const client = await newClient();

		expect((await archive(crypto.randomUUID())).status).toBe(404);
		expect((await restore(client.id)).status).toBe(409);
		expect((await archive(client.id)).status).toBe(200);
		const again = await archive(client.id);
		expect(again.status).toBe(409);
		expect(again.body.error.code).toBe("CONFLICT");
	});

	it("only admin may archive or restore (matrix): user 403, viewer 403, anonymous 401", async () => {
		const client = await newClient();

		expect((await archive(client.id, writer)).status).toBe(403);
		expect((await archive(client.id, viewer)).status).toBe(403);
		expect((await api(`/api/clients/${client.id}/archive`, { method: "POST" })).status).toBe(401);

		await archive(client.id);
		expect((await restore(client.id, writer)).status).toBe(403);
		expect((await restore(client.id, viewer)).status).toBe(403);
	});
});

describe("archived clients in lists (FR-41)", () => {
	it("are excluded from the default list and the total", async () => {
		const client = await newClient();
		expect(await listIds(client.companyName)).toEqual([client.id]);

		await archive(client.id);

		expect(await listIds(client.companyName)).toEqual([]);
		const r = await api(`/api/clients?q=${encodeURIComponent(client.companyName)}`, {}, admin);
		expect(r.body.total).toBe(0);
	});

	it("admin gets archived=only and archived=include", async () => {
		const live = await newClient();
		const gone = await newClient();
		await archive(gone.id);
		// Same unique prefix is not shared, so check each by its own name.
		expect(await listIds(gone.companyName, "&archived=only")).toEqual([gone.id]);
		expect(await listIds(live.companyName, "&archived=only")).toEqual([]);
		expect(await listIds(gone.companyName, "&archived=include")).toEqual([gone.id]);
		expect(await listIds(live.companyName, "&archived=include")).toEqual([live.id]);
	});

	it("is ignored for user and viewer: archived clients are never returned", async () => {
		const client = await newClient();
		await archive(client.id);

		for (const token of [writer, viewer]) {
			expect(await listIds(client.companyName, "&archived=only", token)).toEqual([]);
			expect(await listIds(client.companyName, "&archived=include", token)).toEqual([]);
		}
	});

	it("rejects an unknown archived value", async () => {
		const r = await api("/api/clients?archived=maybe", {}, admin);
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("restore brings the client back to the default list", async () => {
		const client = await newClient();
		await archive(client.id);
		await restore(client.id);

		expect(await listIds(client.companyName)).toEqual([client.id]);
	});
});

describe("archived client and tenders (FR-42, FR-48)", () => {
	it("an archived client cannot be used for a new tender (422)", async () => {
		const client = await newClient();
		await archive(client.id);

		const r = await createTender(client.id);

		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("a restored client can be used again", async () => {
		const client = await newClient();
		await archive(client.id);
		await restore(client.id);

		expect((await createTender(client.id)).status).toBe(201);
	});

	it("existing tenders of an archived client are unchanged and still listed", async () => {
		const client = await newClient();
		const tender = (await createTender(client.id)).body.tender;
		await forceStatus(tender.id, "collected");

		expect((await archive(client.id)).status).toBe(200);

		const detail = await api(`/api/tenders/${tender.id}`, {}, admin);
		expect(detail.status).toBe(200);
		expect(detail.body.tender.status).toBe("collected");
		expect(detail.body.tender.clientId).toBe(client.id);
		expect(detail.body.tender.clientName).toBe("Archive Contact");
		const list = await api(`/api/tenders?q=${encodeURIComponent(client.companyName)}`, {}, admin);
		expect(list.body.data.map((t: { id: string }) => t.id)).toContain(tender.id);
	});

	it.each(["draft", "active", "finalized", "for_collection"])(
		"archiving a client with a %s tender is 409 and leaves the client live",
		async (status) => {
			const client = await newClient();
			const tender = (await createTender(client.id)).body.tender;
			await forceStatus(tender.id, status);

			const r = await archive(client.id);

			expect(r.status).toBe(409);
			expect(r.body.error.code).toBe("CONFLICT");
			expect(await listIds(client.companyName)).toEqual([client.id]);
		},
	);

	it.each(["collected", "lost"])("archiving a client whose only tender is %s succeeds", async (status) => {
		const client = await newClient();
		const tender = (await createTender(client.id)).body.tender;
		await forceStatus(tender.id, status);

		expect((await archive(client.id)).status).toBe(200);
	});

	it("a tender whose real flow reached active blocks archiving", async () => {
		const client = await newClient();
		const tender = (await createTender(client.id)).body.tender;
		const product = await postJson("/api/products", { name: uniqueName("Archive P"), unitPrice: 10 }, admin);
		await postJson(
			`/api/tenders/${tender.id}/products`,
			{ productId: product.body.product.id, quantity: 1 },
			admin,
		);
		await uploadPdf(tender.id, admin);
		expect((await postJson(`/api/tenders/${tender.id}/send`, {}, admin)).status).toBe(200);

		expect((await archive(client.id)).status).toBe(409);
	});

	it("archive racing a tender create never leaves an archived client with an open tender", async () => {
		for (let i = 0; i < 3; i++) {
			const client = await newClient();

			const [archived, created] = await Promise.all([archive(client.id), createTender(client.id)]);

			const open = await withSql(
				(sql) => sql`select count(*)::int as n from tenders where client_id = ${client.id}`,
			);
			if (archived.status === 200) {
				expect(created.status).toBe(422);
				expect(open[0]?.n).toBe(0);
			} else {
				expect(archived.status).toBe(409);
				expect(created.status).toBe(201);
			}
		}
	});
});
