import { beforeAll, describe, expect, it } from "vitest";
import { api, login, uniqueName } from "./helpers";

let admin: string;
let clientId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	// Use the oldest client of the first page: pagination.test.ts creates its own (newest) client and
	// deletes its tenders on teardown while files run concurrently.
	const clients = await api("/api/clients?pageSize=100", {}, admin);
	clientId = clients.body.data.at(-1).id;
});

async function createProduct() {
	const r = await api(
		"/api/products",
		{ method: "POST", body: JSON.stringify({ name: uniqueName("Deactivatable"), unitPrice: 10 }) },
		admin,
	);
	return r.body.product.id as string;
}

function setActive(productId: string, active: boolean, token = admin) {
	return api(`/api/products/${productId}`, { method: "PATCH", body: JSON.stringify({ active }) }, token);
}

async function createTender() {
	const tender = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({
				clientId,
				title: "Inactive Products Tender",
				maxBudget: 1000,
				deadline: new Date(Date.now() + 86_400_000).toISOString(),
			}),
		},
		admin,
	);
	return tender.body.tender.id as string;
}

function addProduct(tenderId: string, productId: string) {
	return api(
		`/api/tenders/${tenderId}/products`,
		{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
		admin,
	);
}

describe("an admin deactivates and reactivates a product (FR-39)", () => {
	it("a new product is active", async () => {
		const id = await createProduct();
		const list = await api("/api/products?pageSize=100", {}, admin);
		expect(list.body.data.find((p: { id: string }) => p.id === id).active).toBe(true);
	});

	it("PATCH active=false deactivates, active=true reactivates; the product is not removed", async () => {
		const id = await createProduct();

		const off = await setActive(id, false);
		expect(off.status).toBe(200);
		expect(off.body.product.active).toBe(false);

		const on = await setActive(id, true);
		expect(on.status).toBe(200);
		expect(on.body.product.active).toBe(true);
	});

	it("a non-admin user cannot change the flag", async () => {
		const email = `inactive-user-${Date.now()}@example.com`;
		await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email, password: "UserPass123!", role: "user" }) },
			admin,
		);
		const userToken = await login(email, "UserPass123!");
		const id = await createProduct();

		const r = await setActive(id, false, userToken);
		expect(r.status).toBe(403);
		expect(r.body.error.code).toBe("FORBIDDEN");
	});
});

describe("an inactive product cannot be added to a tender (FR-46)", () => {
	it("adding an inactive product -> 422 BUSINESS_RULE_VIOLATION", async () => {
		const tenderId = await createTender();
		const productId = await createProduct();
		await setActive(productId, false);

		const r = await addProduct(tenderId, productId);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.products).toHaveLength(0);
	});

	it("existing lines of a later-deactivated product are kept unchanged", async () => {
		const tenderId = await createTender();
		const productId = await createProduct();
		expect((await addProduct(tenderId, productId)).status).toBe(201);

		await setActive(productId, false);

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.products).toHaveLength(1);
		expect(detail.body.tender.products[0].productId).toBe(productId);
		expect(detail.body.tender.products[0].subtotal).toBe("10.00");
	});

	it("a reactivated product can be added again", async () => {
		const tenderId = await createTender();
		const productId = await createProduct();
		await setActive(productId, false);
		await setActive(productId, true);

		expect((await addProduct(tenderId, productId)).status).toBe(201);
	});
});
