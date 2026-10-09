import { env } from "cloudflare:workers";
import postgres from "postgres";
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

async function createProduct(name: string) {
	return api("/api/products", { method: "POST", body: JSON.stringify({ name, unitPrice: 10 }) }, admin);
}

async function createClient(name: string, email: string) {
	return api(
		"/api/clients",
		{ method: "POST", body: JSON.stringify({ name, companyName: "Acme", email }) },
		admin,
	);
}

describe("product names are unique ignoring case (DAT-14)", () => {
	it("creating a product with an existing name -> 409 CONFLICT", async () => {
		const name = uniqueName("Widget");
		expect((await createProduct(name)).status).toBe(201);

		const dup = await createProduct(name);
		expect(dup.status).toBe(409);
		expect(dup.body.error.code).toBe("CONFLICT");
	});

	it("case differences do not make a name distinct", async () => {
		const name = uniqueName("Widget");
		await createProduct(name);
		const dup = await createProduct(name.toUpperCase());
		expect(dup.status).toBe(409);
		expect(dup.body.error.code).toBe("CONFLICT");
	});

	it("renaming a product to another product's name -> 409 CONFLICT", async () => {
		const taken = uniqueName("Taken");
		await createProduct(taken);
		const other = await createProduct(uniqueName("Other"));

		const r = await api(
			`/api/products/${other.body.product.id}`,
			{ method: "PATCH", body: JSON.stringify({ name: taken.toLowerCase() }) },
			admin,
		);
		expect(r.status).toBe(409);
		expect(r.body.error.code).toBe("CONFLICT");
	});

	it("a product can change the case of its own name", async () => {
		const name = uniqueName("Mixed");
		const created = await createProduct(name);

		const r = await api(
			`/api/products/${created.body.product.id}`,
			{ method: "PATCH", body: JSON.stringify({ name: name.toUpperCase() }) },
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.product.name).toBe(name.toUpperCase());
	});

	it("client names and emails are not unique", async () => {
		const name = uniqueName("Same Client");
		const first = await createClient(name, "delivered@resend.dev");
		const second = await createClient(name, "delivered@resend.dev");
		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
	});

	it("the database rejects a duplicate name on its own", async () => {
		const name = uniqueName("Raw");
		await createProduct(name);

		const sql = postgres(env.HYPERDRIVE.connectionString);
		try {
			await expect(
				sql`insert into products (name, unit_price) values (${name.toUpperCase()}, 1)`,
			).rejects.toMatchObject({ code: "23505" });
		} finally {
			await sql.end();
		}
	});
});

describe("user emails are unique (DAT-15)", () => {
	it("creating a user with an existing email -> 409 CONFLICT", async () => {
		const email = `dup-${crypto.randomUUID()}@example.com`;
		const body = JSON.stringify({ email, password: "UserPass123!", role: "user" });
		expect((await api("/api/users", { method: "POST", body }, admin)).status).toBe(201);

		const dup = await api("/api/users", { method: "POST", body }, admin);
		expect(dup.status).toBe(409);
		expect(dup.body.error.code).toBe("CONFLICT");
	});

	it("email case differences do not make an email distinct", async () => {
		const r = await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email: "Admin@Example.com", password: "UserPass123!" }) },
			admin,
		);
		expect(r.status).toBe(409);
		expect(r.body.error.code).toBe("CONFLICT");
	});

	it("the seeded admin email cannot be reused", async () => {
		const r = await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email: "admin@example.com", password: "UserPass123!" }) },
			admin,
		);
		expect(r.status).toBe(409);
		expect(r.body.error.code).toBe("CONFLICT");
	});

	it("the database rejects a duplicate email on its own", async () => {
		const sql = postgres(env.HYPERDRIVE.connectionString);
		try {
			await expect(
				sql`insert into profiles (id, email) values (${crypto.randomUUID()}, 'ADMIN@example.com')`,
			).rejects.toMatchObject({ code: "23505" });
		} finally {
			await sql.end();
		}
	});
});

describe("a product appears once per tender (BR-14)", () => {
	async function createTender() {
		const tender = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({
					clientId,
					title: "Uniqueness Tender",
					maxBudget: 1000,
					deadline: new Date(Date.now() + 86_400_000).toISOString(),
				}),
			},
			admin,
		);
		return tender.body.tender.id as string;
	}

	function addProduct(tenderId: string, productId: string, quantity: number) {
		return api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity }) },
			admin,
		);
	}

	it("adding the same product twice -> 409 CONFLICT", async () => {
		const tenderId = await createTender();
		const product = await createProduct(uniqueName("Once"));
		const productId = product.body.product.id as string;

		expect((await addProduct(tenderId, productId, 1)).status).toBe(201);
		const dup = await addProduct(tenderId, productId, 2);
		expect(dup.status).toBe(409);
		expect(dup.body.error.code).toBe("CONFLICT");

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.products).toHaveLength(1);
	});

	it("changing quantity is remove then add", async () => {
		const tenderId = await createTender();
		const product = await createProduct(uniqueName("Requantify"));
		const productId = product.body.product.id as string;

		await addProduct(tenderId, productId, 1);
		await api(`/api/tenders/${tenderId}/products/${productId}`, { method: "DELETE" }, admin);
		const again = await addProduct(tenderId, productId, 5);
		expect(again.status).toBe(201);
		expect(again.body.tenderProduct.quantity).toBe("5.00");
	});

	it("the same product can be in different tenders", async () => {
		const product = await createProduct(uniqueName("Shared"));
		const productId = product.body.product.id as string;

		expect((await addProduct(await createTender(), productId, 1)).status).toBe(201);
		expect((await addProduct(await createTender(), productId, 1)).status).toBe(201);
	});

	it("the database rejects a duplicate tender product on its own", async () => {
		const tenderId = await createTender();
		const product = await createProduct(uniqueName("RawLine"));
		const productId = product.body.product.id as string;
		await addProduct(tenderId, productId, 1);

		const sql = postgres(env.HYPERDRIVE.connectionString);
		try {
			await expect(
				sql`insert into tender_products (tender_id, product_id, quantity, unit_price, subtotal)
					values (${tenderId}, ${productId}, 1, 10, 10)`,
			).rejects.toMatchObject({ code: "23505" });
		} finally {
			await sql.end();
		}
	});
});
