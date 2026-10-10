import { env } from "cloudflare:workers";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { processExpiredTenders } from "../src/jobs/tenders";
import {
	api,
	expectValidationError,
	futureDate,
	login,
	patchJson,
	postJson,
	uniqueName,
	uploadPdf,
} from "./helpers";

let admin: string;
let clientId: string;

async function createTender(maxBudget = 1000, deadline = futureDate()) {
	const r = await postJson(
		"/api/tenders",
		{ clientId, title: "Mutation Fixture", maxBudget, deadline },
		admin,
	);
	expect(r.status).toBe(201);
	return r.body.tender.id as string;
}

async function createProduct(unitPrice: number) {
	const r = await postJson("/api/products", { name: uniqueName("Mutation Product"), unitPrice }, admin);
	return r.body.product.id as string;
}

async function detail(tenderId: string) {
	return (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender;
}

const lineSum = (tender: { products: { subtotal: string }[] }) =>
	tender.products.reduce((sum, p) => sum + Number(p.subtotal), 0);

async function sqlExec(run: (sql: postgres.Sql) => Promise<unknown>) {
	const sql = postgres(env.HYPERDRIVE.connectionString);
	try {
		await run(sql);
	} finally {
		await sql.end();
	}
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await postJson(
		"/api/clients",
		{ name: "Client Mutations", companyName: "Acme", email: "delivered@resend.dev" },
		admin,
	);
	clientId = client.body.client.id;
});

describe("row-locked mutations (BR-09)", () => {
	it("two simultaneous line additions cannot exceed the budget (BR-01, BR-09)", async () => {
		const tenderId = await createTender(500);
		const products = await Promise.all([createProduct(300), createProduct(300), createProduct(300)]);

		const results = await Promise.all(
			products.map((productId) =>
				postJson(`/api/tenders/${tenderId}/products`, { productId, quantity: 1 }, admin),
			),
		);

		expect(results.filter((r) => r.status === 201)).toHaveLength(1);
		for (const r of results.filter((r) => r.status !== 201)) {
			expect(r.status).toBe(422);
			expect(r.body.error.code).toBe("TENDER_BUDGET_EXCEEDED");
		}
		expect(lineSum(await detail(tenderId))).toBeLessThanOrEqual(500);
	});

	it("budget reduction against a simultaneous line addition keeps lines within budget (BR-01, BR-09)", async () => {
		const tenderId = await createTender(500);
		const [first, second] = await Promise.all([createProduct(200), createProduct(200)]);
		await postJson(`/api/tenders/${tenderId}/products`, { productId: first, quantity: 1 }, admin);

		const [add, reduce] = await Promise.all([
			postJson(`/api/tenders/${tenderId}/products`, { productId: second, quantity: 1 }, admin),
			patchJson(`/api/tenders/${tenderId}`, { maxBudget: 300 }, admin),
		]);

		// Exactly one of them wins; both together would leave 400 against a 300 budget.
		expect([add.status, reduce.status].filter((s) => s === 422)).toHaveLength(1);
		const tender = await detail(tenderId);
		expect(lineSum(tender)).toBeLessThanOrEqual(Number(tender.maxBudget));
	});

	it("send against a simultaneous line change leaves a consistent tender (BR-09)", async () => {
		const tenderId = await createTender(1000);
		const [kept, added] = await Promise.all([createProduct(100), createProduct(100)]);
		await postJson(`/api/tenders/${tenderId}/products`, { productId: kept, quantity: 1 }, admin);
		await uploadPdf(tenderId, admin);

		const [send, add] = await Promise.all([
			api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin),
			postJson(`/api/tenders/${tenderId}/products`, { productId: added, quantity: 1 }, admin),
		]);

		expect(send.status).toBe(200);
		expect(add.status).toBe(201);
		const tender = await detail(tenderId);
		expect(tender.status).toBe("active");
		expect(tender.products).toHaveLength(2);
		const history = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		expect(history.body.history.filter((h: { toStatus: string }) => h.toStatus === "active")).toHaveLength(1);
	});

	it("two simultaneous sends transition once (BR-09, BR-08)", async () => {
		const tenderId = await createTender();
		await uploadPdf(tenderId, admin);

		const results = await Promise.all([
			api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin),
			api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin),
		]);

		expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
		const history = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		expect(history.body.history).toHaveLength(1);
	});

	it("removal and finalize each lock the tender and 404 on a missing one (BR-09)", async () => {
		const missing = "00000000-0000-0000-0000-000000000000";
		const productId = await createProduct(10);
		expect(
			(await api(`/api/tenders/${missing}/products/${productId}`, { method: "DELETE" }, admin)).status,
		).toBe(404);
		expect((await api(`/api/tenders/${missing}/finalize`, { method: "POST" }, admin)).status).toBe(404);
		expect((await api(`/api/tenders/${missing}/lost`, { method: "POST" }, admin)).status).toBe(404);
		expect((await postJson(`/api/tenders/${missing}/invoice`, { invoiceAmount: 10 }, admin)).status).toBe(
			404,
		);
		expect((await uploadPdf(missing, admin)).status).toBe(404);
	});
});

describe("draft-only budget and deadline edits (FR-43, BR-10)", () => {
	it("edits budget and deadline in draft -> 200", async () => {
		const tenderId = await createTender(500);
		const deadline = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

		const r = await patchJson(`/api/tenders/${tenderId}`, { maxBudget: 750.5, deadline }, admin);

		expect(r.status).toBe(200);
		expect(Number(r.body.tender.maxBudget)).toBe(750.5);
		expect(new Date(r.body.tender.deadline).toISOString()).toBe(deadline);
	});

	it("new budget equal to the sum of lines is accepted, lower is rejected (FR-43, BR-01)", async () => {
		const tenderId = await createTender(1000);
		const productId = await createProduct(100);
		await postJson(`/api/tenders/${tenderId}/products`, { productId, quantity: 3 }, admin);

		const equal = await patchJson(`/api/tenders/${tenderId}`, { maxBudget: 300 }, admin);
		expect(equal.status).toBe(200);

		const lower = await patchJson(`/api/tenders/${tenderId}`, { maxBudget: 299.99 }, admin);
		expect(lower.status).toBe(422);
		expect(lower.body.error.code).toBe("TENDER_BUDGET_EXCEEDED");
		expect(Number((await detail(tenderId)).maxBudget)).toBe(300);
	});

	it("deadline in the past is rejected on edit and on creation (BR-02)", async () => {
		const tenderId = await createTender();
		const past = new Date(Date.now() - 60_000).toISOString();

		expectValidationError(await patchJson(`/api/tenders/${tenderId}`, { deadline: past }, admin), "deadline");
		expectValidationError(
			await postJson("/api/tenders", { clientId, title: "Past", maxBudget: 10, deadline: past }, admin),
			"deadline",
		);
	});

	it("budget and deadline are rejected outside draft, title still editable (BR-10)", async () => {
		const tenderId = await createTender(500);
		await uploadPdf(tenderId, admin);
		expect((await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin)).status).toBe(200);
		const before = await detail(tenderId);

		for (const body of [{ maxBudget: 900 }, { deadline: futureDate() }, { title: "Mixed", maxBudget: 900 }]) {
			const r = await patchJson(`/api/tenders/${tenderId}`, body, admin);
			expect(r.status).toBe(422);
			expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
		}

		const after = await detail(tenderId);
		expect(after.maxBudget).toBe(before.maxBudget);
		expect(after.deadline).toBe(before.deadline);
		expect(after.title).toBe(before.title);

		const title = await patchJson(`/api/tenders/${tenderId}`, { title: "Renamed while active" }, admin);
		expect(title.status).toBe(200);
	});

	it("client and status stay immutable through PATCH (FR-13, BR-10)", async () => {
		const tenderId = await createTender();
		const otherClient = await postJson(
			"/api/clients",
			{ name: "Other Client", companyName: "Other", email: "other@resend.dev" },
			admin,
		);

		const r = await patchJson(
			`/api/tenders/${tenderId}`,
			{ title: "Still mine", clientId: otherClient.body.client.id, status: "collected" },
			admin,
		);

		expect(r.status).toBe(200);
		expect(r.body.tender.clientId).toBe(clientId);
		expect(r.body.tender.status).toBe("draft");
	});

	it("editing a missing tender -> 404", async () => {
		const r = await patchJson("/api/tenders/00000000-0000-0000-0000-000000000000", { maxBudget: 10 }, admin);
		expect(r.status).toBe(404);
	});
});

describe("deadline and sending (BR-02, BR-15)", () => {
	it("sending with a deadline not in the future -> 422 and stays draft (BR-15)", async () => {
		const tenderId = await createTender();
		await uploadPdf(tenderId, admin);
		await sqlExec(
			(sql) => sql`update tenders set deadline = now() - interval '1 hour' where id = ${tenderId}`,
		);

		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);

		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
		expect((await detail(tenderId)).status).toBe("draft");
	});

	it("send checks the proposal before the deadline (FR-17)", async () => {
		const tenderId = await createTender();
		await sqlExec(
			(sql) => sql`update tenders set deadline = now() - interval '1 hour' where id = ${tenderId}`,
		);

		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);

		expect(r.status).toBe(422);
		expect(r.body.error.message).toContain("proposal");
	});

	it("a draft with a past deadline never expires (BR-15)", async () => {
		const tenderId = await createTender();
		await sqlExec(
			(sql) => sql`update tenders set deadline = now() - interval '1 hour' where id = ${tenderId}`,
		);

		await processExpiredTenders(env);

		expect((await detail(tenderId)).status).toBe("draft");
	});

	it("an expired draft can be rescued by moving its deadline (FR-43)", async () => {
		const tenderId = await createTender();
		await uploadPdf(tenderId, admin);
		await sqlExec(
			(sql) => sql`update tenders set deadline = now() - interval '1 hour' where id = ${tenderId}`,
		);

		expect((await patchJson(`/api/tenders/${tenderId}`, { deadline: futureDate() }, admin)).status).toBe(200);
		expect((await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin)).status).toBe(200);
	});
});
