import { beforeAll, describe, expect, it } from "vitest";
import {
	api,
	expectValidationError,
	futureDate,
	login,
	patchJson,
	postJson,
	uniqueName,
	uploadPdf,
	withSql,
} from "./helpers";

let admin: string;
let writer: string;
let viewer: string;
let clientId: string;

async function createUserToken(role: "user" | "viewer") {
	const email = `invoice-fix-${role}-${crypto.randomUUID().slice(0, 8)}@example.com`;
	const created = await postJson("/api/users", { email, password: "RolePass12345!", role }, admin);
	expect(created.status).toBe(201);
	return login(email, "RolePass12345!");
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	writer = await createUserToken("user");
	viewer = await createUserToken("viewer");
	const client = await postJson(
		"/api/clients",
		{ name: "Invoice Fix Contact", companyName: "Invoice Fix Co", email: "delivered@resend.dev" },
		admin,
	);
	clientId = client.body.client.id;
});

/** Walks a tender to `finalized` with one line of 100.00 against a 1000 budget. */
async function finalizedTender() {
	const created = await postJson(
		"/api/tenders",
		{ clientId, title: "Invoice Fix Tender", maxBudget: 1000, deadline: futureDate() },
		admin,
	);
	const tenderId = created.body.tender.id as string;
	const product = await postJson("/api/products", { name: uniqueName("Invoice Fix"), unitPrice: 100 }, admin);
	await postJson(
		`/api/tenders/${tenderId}/products`,
		{ productId: product.body.product.id, quantity: 1 },
		admin,
	);
	await uploadPdf(tenderId, admin);
	expect((await postJson(`/api/tenders/${tenderId}/send`, {}, admin)).status).toBe(200);
	expect((await postJson(`/api/tenders/${tenderId}/finalize`, {}, admin)).status).toBe(200);
	return tenderId;
}

async function invoicedTender(invoiceAmount = 100) {
	const tenderId = await finalizedTender();
	const inv = await postJson(`/api/tenders/${tenderId}/invoice`, { invoiceAmount }, admin);
	expect(inv.status).toBe(200);
	return tenderId;
}

const correct = (tenderId: string, invoiceAmount: unknown, token = admin) =>
	patchJson(`/api/tenders/${tenderId}/invoice`, { invoiceAmount }, token);

const history = async (tenderId: string) =>
	(await api(`/api/tenders/${tenderId}/history`, {}, admin)).body.history as unknown[];

describe("invoice correction (FR-50)", () => {
	it("admin corrects the amount of a for_collection tender with no payments", async () => {
		const tenderId = await invoicedTender(100);

		const r = await correct(tenderId, 250.5);

		expect(r.status).toBe(200);
		expect(r.body.tender.invoiceAmount).toBe("250.50");
		expect(r.body.tender.status).toBe("for_collection");
	});

	it("status and history are unchanged by the correction (FR-50)", async () => {
		const tenderId = await invoicedTender(100);
		const before = await history(tenderId);

		await correct(tenderId, 150);

		expect(await history(tenderId)).toEqual(before);
	});

	it("records the modifier and timestamp (DAT-06)", async () => {
		const tenderId = await invoicedTender(100);
		const me = (await api("/api/auth/me", {}, admin)).body.user;
		const before = (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender;
		await new Promise((r) => setTimeout(r, 10));

		const r = await correct(tenderId, 175);

		expect(r.body.tender.updatedBy).toBe(me.id);
		expect(new Date(r.body.tender.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
	});

	it("can be corrected repeatedly while there are no payments (FR-50)", async () => {
		const tenderId = await invoicedTender(100);
		expect((await correct(tenderId, 200)).status).toBe(200);
		const r = await correct(tenderId, 300);
		expect(r.status).toBe(200);
		expect(r.body.tender.invoiceAmount).toBe("300.00");
	});

	it("is rejected once a payment is registered (FR-50)", async () => {
		const tenderId = await invoicedTender(100);
		expect((await postJson(`/api/tenders/${tenderId}/payments`, { amount: 10 }, admin)).status).toBe(201);

		const r = await correct(tenderId, 500);

		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
		const detail = (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender;
		expect(detail.invoiceAmount).toBe("100.00");
	});

	it.each(["draft", "active", "finalized"] as const)(
		"is rejected in %s, where there is no invoice yet (FR-50)",
		async (status) => {
			const tenderId = await finalizedTender();
			if (status !== "finalized") {
				await withSql((sql) => sql`update tenders set status = ${status} where id = ${tenderId}`);
			}

			const r = await correct(tenderId, 500);

			expect(r.status).toBe(422);
			expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
			const detail = (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender;
			expect(detail.invoiceAmount).toBeNull();
		},
	);

	it("is rejected in collected (FR-50)", async () => {
		const tenderId = await invoicedTender(100);
		await postJson(`/api/tenders/${tenderId}/payments`, { amount: 100 }, admin);

		const r = await correct(tenderId, 500);

		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("404 on a missing tender (BR-09)", async () => {
		const r = await correct("00000000-0000-0000-0000-000000000000", 10);
		expect(r.status).toBe(404);
	});

	it("only an admin may correct: writer and viewer get 403, anonymous 401 (SEC-01)", async () => {
		const tenderId = await invoicedTender(100);

		expect((await correct(tenderId, 50, writer)).status).toBe(403);
		expect((await correct(tenderId, 50, viewer)).status).toBe(403);
		const anonymous = await api(`/api/tenders/${tenderId}/invoice`, {
			method: "PATCH",
			body: JSON.stringify({ invoiceAmount: 50 }),
		});
		expect(anonymous.status).toBe(401);
		const detail = (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender;
		expect(detail.invoiceAmount).toBe("100.00");
	});
});

describe("invoiced amount bounds (BR-16, DAT-13)", () => {
	it.each([0, -1, -0.01])("amount %s is rejected as VALIDATION_ERROR", async (amount) => {
		const tenderId = await invoicedTender(100);
		expectValidationError(await correct(tenderId, amount), "invoiceAmount");
	});

	it("is not capped by the tender budget (BR-16)", async () => {
		const tenderId = await invoicedTender(100); // budget 1000, lines 100

		const r = await correct(tenderId, 5000);

		expect(r.status).toBe(200);
		expect(r.body.tender.invoiceAmount).toBe("5000.00");
	});

	it("is not capped by the sum of the lines (BR-16)", async () => {
		const tenderId = await invoicedTender(100);

		const r = await correct(tenderId, 0.01);

		expect(r.status).toBe(200);
		expect(r.body.tender.invoiceAmount).toBe("0.01");
	});

	it("accepts exactly the money maximum (DAT-13)", async () => {
		const tenderId = await invoicedTender(100);

		const r = await correct(tenderId, 9_999_999_999.99);

		expect(r.status).toBe(200);
		expect(r.body.tender.invoiceAmount).toBe("9999999999.99");
	});

	it("rejects sub-cent amounts (DAT-13)", async () => {
		const tenderId = await invoicedTender(100);
		expectValidationError(await correct(tenderId, 0.001), "invoiceAmount");
	});

	it("is still bounded by the money maximum (DAT-13)", async () => {
		const tenderId = await invoicedTender(100);
		expectValidationError(await correct(tenderId, 10_000_000_000), "invoiceAmount");
	});
});

describe("invoice correction locking (BR-09)", () => {
	it("a payment racing a correction never leaves a payment on a changed invoice", async () => {
		const tenderId = await invoicedTender(100);

		const [pay, fix] = await Promise.all([
			postJson(`/api/tenders/${tenderId}/payments`, { amount: 40 }, admin),
			correct(tenderId, 40),
		]);

		const detail = (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender;
		const payments = (await api(`/api/tenders/${tenderId}/payments`, {}, admin)).body.payments;
		if (pay.status === 201 && fix.status === 200) {
			// correction ran first: payment of 40 settled the new 40.00 invoice
			expect(detail.status).toBe("collected");
			expect(detail.invoiceAmount).toBe("40.00");
		} else {
			// payment ran first: the correction was refused and the invoice is intact
			expect(pay.status).toBe(201);
			expect(fix.status).toBe(422);
			expect(detail.invoiceAmount).toBe("100.00");
		}
		expect(payments).toHaveLength(1);
	});
});
