import { env } from "cloudflare:workers";
import postgres from "postgres";
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
} from "./helpers";

let admin: string;
let clientId: string;

const post = (path: string, body: unknown) => postJson(path, body, admin);
const patch = (path: string, body: unknown) => patchJson(path, body, admin);

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await post("/api/clients", {
		name: "Integrity Contact",
		companyName: "Integrity Co",
		email: "integrity@example.com",
	});
	clientId = client.body.client.id;
});

async function createTender(maxBudget = 1000) {
	const r = await post("/api/tenders", {
		clientId,
		title: "Integrity Tender",
		maxBudget,
		deadline: futureDate(),
	});
	return r.body.tender.id as string;
}

async function createProduct(unitPrice = 10) {
	const r = await post("/api/products", { name: uniqueName("Integrity"), unitPrice });
	return r.body.product.id as string;
}

async function invoicedTender(invoiceAmount: number) {
	const tenderId = await createTender(invoiceAmount);
	const productId = await createProduct(invoiceAmount);
	await post(`/api/tenders/${tenderId}/products`, { productId, quantity: 1 });
	await uploadPdf(tenderId, admin);
	await post(`/api/tenders/${tenderId}/send`, {});
	await post(`/api/tenders/${tenderId}/finalize`, {});
	const inv = await post(`/api/tenders/${tenderId}/invoice`, { invoiceAmount });
	expect(inv.status).toBe(200);
	return tenderId;
}

describe("invalid input is 400 VALIDATION_ERROR naming the field, never FORBIDDEN (SEC-10)", () => {
	it("negative product price", async () => {
		expectValidationError(
			await post("/api/products", { name: uniqueName("Neg"), unitPrice: -1 }),
			"unitPrice",
		);
	});

	it("zero product price (FR-09)", async () => {
		expectValidationError(
			await post("/api/products", { name: uniqueName("Zero"), unitPrice: 0 }),
			"unitPrice",
		);
	});

	it("negative tender budget", async () => {
		expectValidationError(
			await post("/api/tenders", { clientId, title: "T", maxBudget: -5, deadline: futureDate() }),
			"maxBudget",
		);
	});

	it("zero payment", async () => {
		const tenderId = await invoicedTender(500);
		expectValidationError(await post(`/api/tenders/${tenderId}/payments`, { amount: 0 }), "amount");
	});

	it("zero invoice amount (DAT-09)", async () => {
		const tenderId = await createTender();
		expectValidationError(
			await post(`/api/tenders/${tenderId}/invoice`, { invoiceAmount: 0 }),
			"invoiceAmount",
		);
	});
});

describe("money range 0.01 to 9,999,999,999.99 (DAT-13)", () => {
	it("rejects above the maximum", async () => {
		expectValidationError(
			await post("/api/products", { name: uniqueName("Big"), unitPrice: 10_000_000_000 }),
			"unitPrice",
		);
		expectValidationError(
			await post("/api/tenders", { clientId, title: "T", maxBudget: 10_000_000_000, deadline: futureDate() }),
			"maxBudget",
		);
	});

	it("rejects below the minimum and more than two decimals", async () => {
		expectValidationError(
			await post("/api/products", { name: uniqueName("Tiny"), unitPrice: 0.001 }),
			"unitPrice",
		);
		expectValidationError(
			await post("/api/products", { name: uniqueName("Fine"), unitPrice: 10.555 }),
			"unitPrice",
		);
	});

	it("accepts the exact bounds", async () => {
		expect((await post("/api/products", { name: uniqueName("Min"), unitPrice: 0.01 })).status).toBe(201);
		expect(
			(await post("/api/products", { name: uniqueName("Max"), unitPrice: 9_999_999_999.99 })).status,
		).toBe(201);
	});

	it("applies to payments and invoices too", async () => {
		const tenderId = await createTender();
		expectValidationError(
			await post(`/api/tenders/${tenderId}/invoice`, { invoiceAmount: 10_000_000_000 }),
			"invoiceAmount",
		);
	});
});

describe("line quantity is a whole number >= 1 (BR-17)", () => {
	it("rejects fractional, zero, negative and absurdly large quantities", async () => {
		const tenderId = await createTender();
		const productId = await createProduct();
		for (const quantity of [0.5, 0, -1, 2_147_483_648]) {
			expectValidationError(
				await post(`/api/tenders/${tenderId}/products`, { productId, quantity }),
				"quantity",
			);
		}
	});

	it("stores a whole quantity", async () => {
		const tenderId = await createTender();
		const productId = await createProduct();
		const r = await post(`/api/tenders/${tenderId}/products`, { productId, quantity: 3 });
		expect(r.status).toBe(201);
		expect(r.body.tenderProduct.quantity).toBe(3);
	});
});

describe("maximum text lengths (DAT-12)", () => {
	const long = (n: number) => "x".repeat(n + 1);
	const longEmail = `${"a".repeat(250)}@b.co`; // 255 chars

	it("tender title 200 and description 5,000", async () => {
		const base = { clientId, maxBudget: 100, deadline: futureDate() };
		expectValidationError(await post("/api/tenders", { ...base, title: long(200) }), "title");
		expectValidationError(
			await post("/api/tenders", { ...base, title: "ok", description: long(5000) }),
			"description",
		);
		expect(
			(await post("/api/tenders", { ...base, title: "x".repeat(200), description: "y".repeat(5000) })).status,
		).toBe(201);

		const tenderId = await createTender();
		expectValidationError(await patch(`/api/tenders/${tenderId}`, { title: long(200) }), "title");
		expectValidationError(
			await patch(`/api/tenders/${tenderId}`, { description: long(5000) }),
			"description",
		);
	});

	it("client contact name, company name and email", async () => {
		const ok = { name: "n", companyName: "c", email: "e@example.com" };
		expectValidationError(await post("/api/clients", { ...ok, name: long(200) }), "name");
		expectValidationError(await post("/api/clients", { ...ok, companyName: long(200) }), "companyName");
		expectValidationError(await post("/api/clients", { ...ok, email: longEmail }), "email");
		expectValidationError(await patch(`/api/clients/${clientId}`, { name: long(200) }), "name");
		expectValidationError(await patch(`/api/clients/${clientId}`, { email: longEmail }), "email");
	});

	it("product name", async () => {
		expectValidationError(await post("/api/products", { name: long(200), unitPrice: 1 }), "name");
	});

	it("product description 5,000", async () => {
		const description = long(5000);
		expectValidationError(
			await post("/api/products", { name: uniqueName("Desc"), unitPrice: 1, description }),
			"description",
		);
		const productId = await createProduct();
		expectValidationError(await patch(`/api/products/${productId}`, { description }), "description");
		expect((await patch(`/api/products/${productId}`, { description: "y".repeat(5000) })).status).toBe(200);
	});

	it("payment reference 100 and note 500", async () => {
		const tenderId = await invoicedTender(500);
		expectValidationError(
			await post(`/api/tenders/${tenderId}/payments`, { amount: 1, reference: long(100) }),
			"reference",
		);
		expectValidationError(
			await post(`/api/tenders/${tenderId}/payments`, { amount: 1, notes: long(500) }),
			"notes",
		);
	});

	it("user email", async () => {
		expectValidationError(
			await post("/api/users", { email: longEmail, password: "Passw0rd!x", role: "user" }),
			"email",
		);
	});
});

describe("client contact fields are required (FR-07, FR-37)", () => {
	it("creating without or with blank name, company or email -> 400", async () => {
		const ok = { name: "n", companyName: "c", email: "e@example.com" };
		for (const field of ["name", "companyName", "email"] as const) {
			const { [field]: _omit, ...missing } = ok;
			expectValidationError(await post("/api/clients", missing), field);
			expectValidationError(await post("/api/clients", { ...ok, [field]: "   " }), field);
		}
	});

	it("editing cannot blank a field", async () => {
		expectValidationError(await patch(`/api/clients/${clientId}`, { companyName: "  " }), "companyName");
	});
});

describe("exact money arithmetic (BR-06, NFR-02, A-1)", () => {
	it("invoice 1,000.00 paid 333.33 then 666.67 ends collected", async () => {
		const tenderId = await invoicedTender(1000);

		const first = await post(`/api/tenders/${tenderId}/payments`, { amount: 333.33 });
		expect(first.status).toBe(201);
		expect(first.body.pendingBalance).toBe(666.67);

		const second = await post(`/api/tenders/${tenderId}/payments`, { amount: 666.67 });
		expect(second.status).toBe(201);
		expect(second.body.pendingBalance).toBe(0);

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("collected");
	});

	it("awkward cents that drift in binary floating point still sum exactly", async () => {
		const tenderId = await invoicedTender(0.3);
		expect((await post(`/api/tenders/${tenderId}/payments`, { amount: 0.1 })).status).toBe(201);
		expect((await post(`/api/tenders/${tenderId}/payments`, { amount: 0.2 })).status).toBe(201);
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("collected");
	});

	it("budget check is exact: lines of 0.10 and 0.20 fit a 0.30 budget", async () => {
		const tenderId = await createTender(0.3);
		const first = await post(`/api/tenders/${tenderId}/products`, {
			productId: await createProduct(0.1),
			quantity: 1,
		});
		const second = await post(`/api/tenders/${tenderId}/products`, {
			productId: await createProduct(0.2),
			quantity: 1,
		});
		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
		const over = await post(`/api/tenders/${tenderId}/products`, {
			productId: await createProduct(0.01),
			quantity: 1,
		});
		expect(over.status).toBe(422);
		expect(over.body.error.code).toBe("TENDER_BUDGET_EXCEEDED");
	});

	it("line subtotal is exact", async () => {
		const tenderId = await createTender(1000);
		const productId = await createProduct(19.99);
		const r = await post(`/api/tenders/${tenderId}/products`, { productId, quantity: 3 });
		expect(r.body.tenderProduct.subtotal).toBe("59.97");
	});
});

describe("the database rejects impossible data on its own (DAT-01..05, DAT-07..12)", () => {
	async function withSql<T>(fn: (sql: postgres.Sql) => Promise<T>) {
		const sql = postgres(env.HYPERDRIVE.connectionString);
		try {
			return await fn(sql);
		} finally {
			await sql.end();
		}
	}

	const CHECK_VIOLATION = { code: "23514" };

	it("tender status is an enumerated type (DAT-01)", async () => {
		const tenderId = await createTender();
		await withSql(async (sql) => {
			await expect(sql`update tenders set status = 'bogus' where id = ${tenderId}`).rejects.toMatchObject({
				code: "22P02",
			});
			const [row] = await sql`select data_type, udt_name from information_schema.columns
				where table_name = 'tenders' and column_name = 'status'`;
			expect(row).toMatchObject({ data_type: "USER-DEFINED", udt_name: "tender_status" });
		});
	});

	it("tender budget must be > 0 (DAT-02)", async () => {
		await withSql(async (sql) => {
			for (const budget of [0, -1]) {
				await expect(
					sql`insert into tenders (client_id, title, max_budget, deadline)
						values (${clientId}, 'raw', ${budget}, now())`,
				).rejects.toMatchObject(CHECK_VIOLATION);
			}
		});
	});

	it("line quantity is an integer >= 1 and unit price > 0 (DAT-07, DAT-08)", async () => {
		const tenderId = await createTender();
		const productId = await createProduct();
		await withSql(async (sql) => {
			await expect(
				sql`insert into tender_products (tender_id, product_id, quantity, unit_price, subtotal)
					values (${tenderId}, ${productId}, 0, 10, 0)`,
			).rejects.toMatchObject(CHECK_VIOLATION);
			await expect(
				sql`insert into tender_products (tender_id, product_id, quantity, unit_price, subtotal)
					values (${tenderId}, ${productId}, 1, 0, 0)`,
			).rejects.toMatchObject(CHECK_VIOLATION);
			// A fractional quantity is rounded to a whole number by the integer column, never stored as is.
			await sql`insert into tender_products (tender_id, product_id, quantity, unit_price, subtotal)
				values (${tenderId}, ${productId}, 2, 10, 20)`;
			const [row] = await sql`select quantity, pg_typeof(quantity)::text as type from tender_products
				where tender_id = ${tenderId}`;
			expect(row).toMatchObject({ quantity: 2, type: "integer" });
		});
	});

	it("invoiced amount, when set, is > 0 (DAT-09)", async () => {
		const tenderId = await createTender();
		await withSql(async (sql) => {
			await expect(sql`update tenders set invoice_amount = 0 where id = ${tenderId}`).rejects.toMatchObject(
				CHECK_VIOLATION,
			);
			await sql`update tenders set invoice_amount = null where id = ${tenderId}`;
		});
	});

	it("payment amount is > 0 (DAT-10)", async () => {
		const tenderId = await createTender();
		await withSql(async (sql) => {
			await expect(
				sql`insert into payments (tender_id, amount) values (${tenderId}, 0)`,
			).rejects.toMatchObject(CHECK_VIOLATION);
		});
	});

	it("product list price is > 0", async () => {
		await withSql(async (sql) => {
			await expect(
				sql`insert into products (name, unit_price) values (${uniqueName("RawProduct")}, 0)`,
			).rejects.toMatchObject(CHECK_VIOLATION);
		});
	});

	it("text lengths are enforced (DAT-12)", async () => {
		await withSql(async (sql) => {
			await expect(
				sql`insert into tenders (client_id, title, max_budget, deadline)
					values (${clientId}, ${"x".repeat(201)}, 1, now())`,
			).rejects.toMatchObject(CHECK_VIOLATION);
			await expect(
				sql`insert into clients (name, company_name, email) values (${"x".repeat(201)}, 'c', 'e@example.com')`,
			).rejects.toMatchObject(CHECK_VIOLATION);
			await expect(
				sql`insert into products (name, unit_price) values (${"x".repeat(201)}, 1)`,
			).rejects.toMatchObject(CHECK_VIOLATION);
			await expect(
				sql`insert into products (name, unit_price, description)
					values (${uniqueName("RawDesc")}, 1, ${"x".repeat(5001)})`,
			).rejects.toMatchObject(CHECK_VIOLATION);
		});
	});

	it("indexes exist on status, deadline and joined foreign keys (DAT-03)", async () => {
		await withSql(async (sql) => {
			const rows = await sql`select indexdef from pg_indexes where schemaname = 'public'`;
			const defs = rows.map((r) => r.indexdef as string);
			const has = (table: string, column: string) =>
				defs.some((d) => d.includes(` ON public.${table} `) && new RegExp(`\\(${column}[,)]`).test(d));
			expect(has("tenders", "status")).toBe(true);
			expect(has("tenders", "deadline")).toBe(true);
			expect(has("tenders", "client_id")).toBe(true);
			expect(has("tender_products", "tender_id")).toBe(true);
			expect(has("tender_products", "product_id")).toBe(true);
			expect(has("payments", "tender_id")).toBe(true);
			expect(has("tender_status_history", "tender_id")).toBe(true);
		});
	});
});
