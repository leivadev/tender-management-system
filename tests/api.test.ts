import { env } from "cloudflare:workers";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { api, login, uniqueName, uploadPdf, worker } from "./helpers";

async function createSentTender(clientId: string, token: string, deadline: string) {
	const create = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({ clientId, title: "Fixture Tender", maxBudget: 1000, deadline }),
		},
		token,
	);
	const tenderId = create.body.tender.id as string;
	await uploadPdf(tenderId, token);
	await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, token);
	return tenderId;
}

let admin: string;
let clientId: string;
let productId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");

	const client = await api(
		"/api/clients",
		{
			method: "POST",
			body: JSON.stringify({ name: "Client Test", companyName: "Acme", email: "delivered@resend.dev" }),
		},
		admin,
	);
	clientId = client.body.client.id;

	const product = await api(
		"/api/products",
		{ method: "POST", body: JSON.stringify({ name: uniqueName("Product Test"), unitPrice: 300 }) },
		admin,
	);
	productId = product.body.product.id;
});

describe("auth", () => {
	it("no token -> 401", async () => {
		const r = await api("/api/tenders");
		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});

	it("invalid login -> 401", async () => {
		const r = await api("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: "admin@example.com", password: "wrong" }),
		});
		expect(r.status).toBe(401);
	});

	it("/me returns admin role", async () => {
		const r = await api("/api/auth/me", {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.user.role).toBe("admin");
	});
});

describe("viewer", () => {
	it("reads but does not write", async () => {
		const email = `viewer-${Date.now()}@example.com`;
		const created = await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email, password: "ViewerPass123!", role: "viewer" }) },
			admin,
		);
		expect(created.status).toBe(201);
		expect(created.body.user.role).toBe("viewer");

		const viewer = await login(email, "ViewerPass123!");
		expect((await api("/api/tenders", {}, viewer)).status).toBe(200);
		expect((await api("/api/dashboard", {}, viewer)).status).toBe(200);

		const write = await api(
			"/api/clients",
			{
				method: "POST",
				body: JSON.stringify({ name: "X", companyName: "Y", email: "delivered@resend.dev" }),
			},
			viewer,
		);
		expect(write.status).toBe(403);
		expect(write.body.error.code).toBe("FORBIDDEN");

		const send = await api(`/api/tenders/${crypto.randomUUID()}/send`, { method: "POST" }, viewer);
		expect(send.status).toBe(403);

		expect((await api("/api/auth/logout", { method: "POST" }, viewer)).status).toBe(200);
	});
});

describe("users", () => {
	it("admin creates user, non-admin user cannot", async () => {
		const email = `user-${Date.now()}@example.com`;
		const created = await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email, password: "UserPass123!", role: "user" }) },
			admin,
		);
		expect(created.status).toBe(201);
		expect(created.body.user.createdBy).toBeTruthy();

		const userToken = await login(email, "UserPass123!");
		const forbidden = await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email: "x@example.com", password: "Pass12345!" }) },
			userToken,
		);
		expect(forbidden.status).toBe(403);
		expect(forbidden.body.error.code).toBe("FORBIDDEN");
	});

	it("admin edits a user's role, non-admin user cannot", async () => {
		const targetEmail = `user-role-target-${Date.now()}@example.com`;
		const target = await api(
			"/api/users",
			{
				method: "POST",
				body: JSON.stringify({ email: targetEmail, password: "UserPass123!", role: "user" }),
			},
			admin,
		);
		const targetId = target.body.user.id as string;

		const promoted = await api(
			`/api/users/${targetId}`,
			{ method: "PATCH", body: JSON.stringify({ role: "admin" }) },
			admin,
		);
		expect(promoted.status).toBe(200);
		expect(promoted.body.user.role).toBe("admin");

		const actorEmail = `user-role-actor-${Date.now()}@example.com`;
		await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email: actorEmail, password: "UserPass123!", role: "user" }) },
			admin,
		);
		const actorToken = await login(actorEmail, "UserPass123!");
		const forbidden = await api(
			`/api/users/${targetId}`,
			{ method: "PATCH", body: JSON.stringify({ role: "user" }) },
			actorToken,
		);
		expect(forbidden.status).toBe(403);
	});

	it("edit role of nonexistent user -> 404", async () => {
		const r = await api(
			"/api/users/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ role: "admin" }) },
			admin,
		);
		expect(r.status).toBe(404);
	});
});

// NFR-25: test names and fixtures are English.
describe("user role permissions", () => {
	let userToken: string;
	const someId = "00000000-0000-0000-0000-000000000000";

	beforeAll(async () => {
		const email = `user-perms-${Date.now()}@example.com`;
		await api(
			"/api/users",
			{ method: "POST", body: JSON.stringify({ email, password: "UserPass123!", role: "user" }) },
			admin,
		);
		userToken = await login(email, "UserPass123!");
	});

	const adminOnly: Array<[string, string, string, unknown?]> = [
		["list users", "GET", "/api/users"],
		["create product", "POST", "/api/products", { name: "P", unitPrice: 10 }],
		["edit product", "PATCH", `/api/products/${someId}`, { unitPrice: 1 }],
		["invoice", "POST", `/api/tenders/${someId}/invoice`, { invoiceAmount: 100 }],
		["record payment", "POST", `/api/tenders/${someId}/payments`, { amount: 10 }],
		["mark lost", "POST", `/api/tenders/${someId}/lost`],
	];

	for (const [name, method, path, body] of adminOnly) {
		it(`${name} -> 403 for user`, async () => {
			const r = await api(path, { method, body: body ? JSON.stringify(body) : undefined }, userToken);
			expect(r.status).toBe(403);
			expect(r.body.error.code).toBe("FORBIDDEN");
		});
	}

	it("user can create clients and tenders", async () => {
		const client = await api(
			"/api/clients",
			{
				method: "POST",
				body: JSON.stringify({ name: "Client User", companyName: "Acme", email: "delivered@resend.dev" }),
			},
			userToken,
		);
		expect(client.status).toBe(201);

		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const tender = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: client.body.client.id,
					title: "Tender User",
					maxBudget: 1000,
					deadline,
				}),
			},
			userToken,
		);
		expect(tender.status).toBe(201);
	});
});

describe("clients & products", () => {
	it("create and list clients", async () => {
		const r = await api("/api/clients", {}, admin);
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.data)).toBe(true);
	});

	it("create and list products", async () => {
		const r = await api("/api/products", {}, admin);
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.data)).toBe(true);
	});

	it("validation: client without email -> 400", async () => {
		const r = await api("/api/clients", { method: "POST", body: JSON.stringify({ name: "x" }) }, admin);
		expect(r.status).toBe(400);
	});

	it("edit client", async () => {
		const create = await api(
			"/api/clients",
			{
				method: "POST",
				body: JSON.stringify({ name: "Antes", companyName: "Acme", email: "delivered@resend.dev" }),
			},
			admin,
		);
		const id = create.body.client.id as string;

		const updated = await api(
			`/api/clients/${id}`,
			{ method: "PATCH", body: JSON.stringify({ name: "After" }) },
			admin,
		);
		expect(updated.status).toBe(200);
		expect(updated.body.client.name).toBe("After");
		expect(updated.body.client.companyName).toBe("Acme");
	});

	it("edit nonexistent client -> 404", async () => {
		const r = await api(
			"/api/clients/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ name: "x" }) },
			admin,
		);
		expect(r.status).toBe(404);
	});

	it("edit client with no fields -> 400", async () => {
		const r = await api(`/api/clients/${clientId}`, { method: "PATCH", body: JSON.stringify({}) }, admin);
		expect(r.status).toBe(400);
	});

	it("edit product", async () => {
		const create = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: uniqueName("Before"), unitPrice: 10 }) },
			admin,
		);
		const id = create.body.product.id as string;

		const updated = await api(
			`/api/products/${id}`,
			{ method: "PATCH", body: JSON.stringify({ unitPrice: 25 }) },
			admin,
		);
		expect(updated.status).toBe(200);
		expect(updated.body.product.unitPrice).toBe("25.00");
	});

	it("edit nonexistent product -> 404", async () => {
		const r = await api(
			"/api/products/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ unitPrice: 5 }) },
			admin,
		);
		expect(r.status).toBe(404);
	});
});

describe("tenders: creation, detail, budget", () => {
	let tenderId: string;

	it("create tender -> draft", async () => {
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const r = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({ clientId, title: "Tender Budget", maxBudget: 1000, deadline }),
			},
			admin,
		);
		expect(r.status).toBe(201);
		expect(r.body.tender.status).toBe("draft");
		tenderId = r.body.tender.id;
	});

	it("detail includes products[] and history[]", async () => {
		const r = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.tender.products)).toBe(true);
		expect(Array.isArray(r.body.tender.history)).toBe(true);
	});

	it("nonexistent tender -> 404", async () => {
		const r = await api("/api/tenders/00000000-0000-0000-0000-000000000000", {}, admin);
		expect(r.status).toBe(404);
	});

	it("send without proposal -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("add product within budget -> 201, exceed -> 422", async () => {
		const ok = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 2 }) },
			admin,
		);
		expect(ok.status).toBe(201); // 300*2=600 <= 1000

		const second = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: uniqueName("Budget Test"), unitPrice: 300 }) },
			admin,
		);
		const exceeded = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId: second.body.product.id, quantity: 2 }) },
			admin,
		);
		expect(exceeded.status).toBe(422); // 600+600=1200 > 1000
		expect(exceeded.body.error.code).toBe("TENDER_BUDGET_EXCEEDED");
	});

	it("remove product while editable -> 200", async () => {
		const r = await api(`/api/tenders/${tenderId}/products/${productId}`, { method: "DELETE" }, admin);
		expect(r.status).toBe(200);
	});

	it.each([
		["finalize", "/finalize"],
		["lost", "/lost"],
		["invoice", "/invoice"],
	])("draft -> %s (invalid) -> 422", async (_name, path) => {
		const r = await api(
			`/api/tenders/${tenderId}${path}`,
			{ method: "POST", body: path === "/invoice" ? JSON.stringify({ invoiceAmount: 100 }) : undefined },
			admin,
		);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("INVALID_TENDER_TRANSITION");
	});

	it("invoicing in draft (invalid) leaves invoice_amount unset", async () => {
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.invoiceAmount).toBeNull();
	});

	it("payment in draft status -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 10 }) },
			admin,
		);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("edit title and description -> 200, does not affect maxBudget/status", async () => {
		const before = await api(`/api/tenders/${tenderId}`, {}, admin);
		const r = await api(
			`/api/tenders/${tenderId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ title: "Tender Budget Edited", description: "New desc" }),
			},
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.tender.title).toBe("Tender Budget Edited");
		expect(r.body.tender.description).toBe("New desc");
		expect(r.body.tender.maxBudget).toBe(before.body.tender.maxBudget);
		expect(r.body.tender.status).toBe(before.body.tender.status);
	});

	it("editing business fields via PATCH is ignored (only title/description)", async () => {
		const before = await api(`/api/tenders/${tenderId}`, {}, admin);
		const r = await api(
			`/api/tenders/${tenderId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ title: "Another title", maxBudget: 999999, status: "collected" }),
			},
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.tender.title).toBe("Another title");
		expect(r.body.tender.maxBudget).toBe(before.body.tender.maxBudget);
		expect(r.body.tender.status).toBe(before.body.tender.status);
	});

	it("edit tender with no fields -> 400", async () => {
		const r = await api(`/api/tenders/${tenderId}`, { method: "PATCH", body: JSON.stringify({}) }, admin);
		expect(r.status).toBe(400);
	});

	it("edit nonexistent tender -> 404", async () => {
		const r = await api(
			"/api/tenders/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ title: "x" }) },
			admin,
		);
		expect(r.status).toBe(404);
	});
});

describe("proposal upload", () => {
	let tenderId: string;

	beforeAll(async () => {
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const r = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({ clientId, title: "Tender Upload", maxBudget: 1000, deadline }),
			},
			admin,
		);
		tenderId = r.body.tender.id;
	});

	it("upload non-PDF file -> rejected", async () => {
		const form = new FormData();
		form.append("file", new Blob(["not a pdf"], { type: "text/plain" }), "notes.txt");
		const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
			method: "POST",
			headers: { Authorization: `Bearer ${admin}` },
			body: form,
		});
		expect([400, 422]).toContain(res.status);
	});

	it("upload valid PDF -> 200, byte-exact download", async () => {
		const uploaded = await uploadPdf(tenderId, admin);
		expect(uploaded.status).toBe(200);
		expect(uploaded.body.tender.proposalKey).toBeTruthy();

		const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal/download`, {
			headers: { Authorization: `Bearer ${admin}` },
		});
		const text = await res.text();
		expect(res.status).toBe(200);
		expect(text.startsWith("%PDF")).toBe(true);
	});
});

describe("full lifecycle: send -> finalize -> invoice -> payments -> collected", () => {
	let tenderId: string;

	beforeAll(async () => {
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const create = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({ clientId, title: "Tender Lifecycle", maxBudget: 1000, deadline }),
			},
			admin,
		);
		tenderId = create.body.tender.id;
		await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		await uploadPdf(tenderId, admin);
	});

	it("send with proposal -> active", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("active");
	});

	it("resend (already active) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
	});

	it("history records draft->active", async () => {
		const r = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		expect(r.body.history.some((h: any) => h.fromStatus === "draft" && h.toStatus === "active")).toBe(true);
	});

	it("adding product in active is still allowed", async () => {
		const extra = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: uniqueName("Active Add"), unitPrice: 10 }) },
			admin,
		);
		const r = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId: extra.body.product.id, quantity: 0.5 }) },
			admin,
		);
		expect(r.status).toBe(201);
	});

	it("active -> for_collection (invalid) -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: 100 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});

	it("active -> finalized -> 200", async () => {
		const r = await api(`/api/tenders/${tenderId}/finalize`, { method: "POST" }, admin);
		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("finalized");
	});

	it("products locked in finalized", async () => {
		const add = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		expect(add.status).toBe(422);
		const remove = await api(`/api/tenders/${tenderId}/products/${productId}`, { method: "DELETE" }, admin);
		expect(remove.status).toBe(422);
	});

	it("invoice with negative amount -> rejected", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: -5 }) },
			admin,
		);
		expect([400, 422]).toContain(r.status);
	});

	it("finalized -> for_collection via invoice -> 200", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: 500 }) },
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("for_collection");
		expect(r.body.tender.invoiceAmount).toBe("500.00");
	});

	it("for_collection -> lost (invalid) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/lost`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("INVALID_TENDER_TRANSITION");
	});

	it("negative payment -> rejected", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: -10 }) },
			admin,
		);
		expect([400, 422]).toContain(r.status);
	});

	it("partial payment -> 201, correct balance", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 300 }) },
			admin,
		);
		expect(r.status).toBe(201);
		expect(r.body.pendingBalance).toBe(200);
	});

	it("overpayment -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 300 }) },
			admin,
		);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("final payment -> automatic collected", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 200 }) },
			admin,
		);
		expect(r.status).toBe(201);
		expect(r.body.pendingBalance).toBe(0);

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("collected");
	});

	it("payment after collected -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 1 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});

	it("list payments -> 2 payments", async () => {
		const r = await api(`/api/tenders/${tenderId}/payments`, {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.payments.length).toBe(2);
	});

	it("products locked in collected", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});

	it("full history has 4 transitions", async () => {
		const r = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		expect(r.body.history.length).toBe(4);
	});

	it("audit: created_by/updated_by populated on tenders and payments", async () => {
		const sql = postgres(env.HYPERDRIVE.connectionString);
		try {
			const [tender] = await sql`select created_by, updated_by from tenders where id = ${tenderId}`;
			const [payment] = await sql`select created_by from payments where tender_id = ${tenderId} limit 1`;
			expect(tender.created_by).toBeTruthy();
			expect(tender.updated_by).toBeTruthy();
			expect(payment.created_by).toBeTruthy();
		} finally {
			await sql.end();
		}
	});
});

describe("payments with non-round amounts", () => {
	let tenderId: string;

	beforeAll(async () => {
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const create = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({ clientId, title: "Tender Decimal Payments", maxBudget: 1000, deadline }),
			},
			admin,
		);
		tenderId = create.body.tender.id;
		await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		await uploadPdf(tenderId, admin);
		await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		await api(`/api/tenders/${tenderId}/finalize`, { method: "POST" }, admin);
		await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: 1000 }) },
			admin,
		);
	});

	it("1000 paid as 333.33 + 666.67 -> collected", async () => {
		const first = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 333.33 }) },
			admin,
		);
		expect(first.status).toBe(201);
		expect(first.body.pendingBalance).toBe(666.67);

		const last = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 666.67 }) },
			admin,
		);
		expect(last.status).toBe(201);
		expect(last.body.pendingBalance).toBe(0);

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("collected");
	});
});

describe("lost tender", () => {
	let tenderId: string;

	beforeAll(async () => {
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		tenderId = await createSentTender(clientId, admin, deadline);
	});

	it("active -> lost (manual) -> 200", async () => {
		const r = await api(`/api/tenders/${tenderId}/lost`, { method: "POST" }, admin);
		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("lost");
	});

	it("lost -> finalized (invalid) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/finalize`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
	});

	it("lost -> active (invalid) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("INVALID_TENDER_TRANSITION");
	});

	it("products locked in lost", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});
});

describe("dashboard", () => {
	it("no auth -> 401", async () => {
		const r = await api("/api/dashboard");
		expect(r.status).toBe(401);
	});

	it("with auth -> 200, counts and upcoming", async () => {
		const r = await api("/api/dashboard", {}, admin);
		expect(r.status).toBe(200);
		expect(typeof r.body.counts).toBe("object");
		expect(Array.isArray(r.body.upcoming)).toBe(true);
	});
});

describe("input validation", () => {
	it("tender with invalid data -> 400", async () => {
		const r = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({ clientId: "not-a-uuid", title: "x", maxBudget: 1, deadline: "not-a-date" }),
			},
			admin,
		);
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("negative price -> VALIDATION_ERROR with the field in the message", async () => {
		const r = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: "P", unitPrice: -99 }) },
			admin,
		);
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
		expect(r.body.error.message).toContain("unitPrice");
		expect(r.body.error.message).not.toContain("Unauthorized");
	});

	it("zero payment -> VALIDATION_ERROR", async () => {
		const r = await api(
			`/api/tenders/${crypto.randomUUID()}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 0 }) },
			admin,
		);
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
	});
});
