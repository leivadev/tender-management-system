import { env, exports } from "cloudflare:workers";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";

const worker = exports.default;

async function api(path: string, init: RequestInit = {}, token?: string) {
	const headers = new Headers(init.headers);
	headers.set("Content-Type", "application/json");
	if (token) headers.set("Authorization", `Bearer ${token}`);
	const res = await worker.fetch(`http://localhost${path}`, { ...init, headers });
	let body: any = null;
	try {
		body = await res.json();
	} catch {
		body = await res.text();
	}
	return { status: res.status, body };
}

async function login(email: string, password: string) {
	const { status, body } = await api("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
	if (status !== 200) throw new Error(`login failed: ${JSON.stringify(body)}`);
	return body.access_token as string;
}

async function uploadPdf(tenderId: string, token: string) {
	const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%%EOF");
	const form = new FormData();
	form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "proposal.pdf");
	const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
		body: form,
	});
	return { status: res.status, body: await res.json() };
}

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
			body: JSON.stringify({ name: "Cliente Test", companyName: "Acme", email: "delivered@resend.dev" }),
		},
		admin,
	);
	clientId = client.body.client.id;

	const product = await api(
		"/api/products",
		{ method: "POST", body: JSON.stringify({ name: "Producto Test", unitPrice: 300 }) },
		admin,
	);
	productId = product.body.product.id;
});

describe("auth", () => {
	it("sin token -> 401", async () => {
		const r = await api("/api/tenders");
		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});

	it("login inválido -> 401", async () => {
		const r = await api("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ email: "admin@example.com", password: "wrong" }),
		});
		expect(r.status).toBe(401);
	});

	it("/me devuelve role admin", async () => {
		const r = await api("/api/auth/me", {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.user.role).toBe("admin");
	});
});

describe("viewer", () => {
	it("lee pero no escribe", async () => {
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
	it("admin crea usuario, user no-admin no puede", async () => {
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

	it("admin edita el rol de un usuario, user no-admin no puede", async () => {
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

	it("editar rol de usuario inexistente -> 404", async () => {
		const r = await api(
			"/api/users/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ role: "admin" }) },
			admin,
		);
		expect(r.status).toBe(404);
	});
});

describe("permisos del rol user", () => {
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
		["listar usuarios", "GET", "/api/users"],
		["crear producto", "POST", "/api/products", { name: "P", unitPrice: 10 }],
		["editar producto", "PATCH", `/api/products/${someId}`, { unitPrice: 1 }],
		["facturar", "POST", `/api/tenders/${someId}/invoice`, { invoiceAmount: 100 }],
		["registrar pago", "POST", `/api/tenders/${someId}/payments`, { amount: 10 }],
		["marcar perdida", "POST", `/api/tenders/${someId}/lost`],
	];

	for (const [name, method, path, body] of adminOnly) {
		it(`${name} -> 403 para user`, async () => {
			const r = await api(path, { method, body: body ? JSON.stringify(body) : undefined }, userToken);
			expect(r.status).toBe(403);
			expect(r.body.error.code).toBe("FORBIDDEN");
		});
	}

	it("user sí puede crear clientes y licitaciones", async () => {
		const client = await api(
			"/api/clients",
			{
				method: "POST",
				body: JSON.stringify({ name: "Cliente User", companyName: "Acme", email: "delivered@resend.dev" }),
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
					title: "Licitacion User",
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
	it("crear y listar clientes", async () => {
		const r = await api("/api/clients", {}, admin);
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.clients)).toBe(true);
	});

	it("crear y listar productos", async () => {
		const r = await api("/api/products", {}, admin);
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.products)).toBe(true);
	});

	it("validación: cliente sin email -> 400", async () => {
		const r = await api("/api/clients", { method: "POST", body: JSON.stringify({ name: "x" }) }, admin);
		expect(r.status).toBe(400);
	});

	it("editar cliente", async () => {
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
			{ method: "PATCH", body: JSON.stringify({ name: "Después" }) },
			admin,
		);
		expect(updated.status).toBe(200);
		expect(updated.body.client.name).toBe("Después");
		expect(updated.body.client.companyName).toBe("Acme");
	});

	it("editar cliente inexistente -> 404", async () => {
		const r = await api(
			"/api/clients/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ name: "x" }) },
			admin,
		);
		expect(r.status).toBe(404);
	});

	it("editar cliente sin campos -> 400", async () => {
		const r = await api(`/api/clients/${clientId}`, { method: "PATCH", body: JSON.stringify({}) }, admin);
		expect(r.status).toBe(400);
	});

	it("editar producto", async () => {
		const create = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: "Antes", unitPrice: 10 }) },
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

	it("editar producto inexistente -> 404", async () => {
		const r = await api(
			"/api/products/00000000-0000-0000-0000-000000000000",
			{ method: "PATCH", body: JSON.stringify({ unitPrice: 5 }) },
			admin,
		);
		expect(r.status).toBe(404);
	});
});

describe("tenders: creación, detalle, presupuesto", () => {
	let tenderId: string;

	it("crear licitación -> draft", async () => {
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const r = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({ clientId, title: "Licitacion Budget", maxBudget: 1000, deadline }),
			},
			admin,
		);
		expect(r.status).toBe(201);
		expect(r.body.tender.status).toBe("draft");
		tenderId = r.body.tender.id;
	});

	it("detalle incluye products[] y history[]", async () => {
		const r = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(r.status).toBe(200);
		expect(Array.isArray(r.body.tender.products)).toBe(true);
		expect(Array.isArray(r.body.tender.history)).toBe(true);
	});

	it("licitación inexistente -> 404", async () => {
		const r = await api("/api/tenders/00000000-0000-0000-0000-000000000000", {}, admin);
		expect(r.status).toBe(404);
	});

	it("enviar sin propuesta -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("agregar producto dentro de presupuesto -> 201, exceder -> 422", async () => {
		const ok = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 2 }) },
			admin,
		);
		expect(ok.status).toBe(201); // 300*2=600 <= 1000

		const exceeded = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 2 }) },
			admin,
		);
		expect(exceeded.status).toBe(422); // 600+600=1200 > 1000
		expect(exceeded.body.error.code).toBe("TENDER_BUDGET_EXCEEDED");
	});

	it("quitar producto mientras es editable -> 200", async () => {
		const r = await api(`/api/tenders/${tenderId}/products/${productId}`, { method: "DELETE" }, admin);
		expect(r.status).toBe(200);
	});

	it.each([
		["finalize", "/finalize"],
		["lost", "/lost"],
		["invoice", "/invoice"],
	])("draft -> %s (inválida) -> 422", async (_name, path) => {
		const r = await api(
			`/api/tenders/${tenderId}${path}`,
			{ method: "POST", body: path === "/invoice" ? JSON.stringify({ invoiceAmount: 100 }) : undefined },
			admin,
		);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("INVALID_TENDER_TRANSITION");
	});

	it("facturar en draft (inválida) no deja invoice_amount seteado", async () => {
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.invoiceAmount).toBeNull();
	});

	it("pago en estado draft -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 10 }) },
			admin,
		);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("editar título y descripción -> 200, no afecta maxBudget/status", async () => {
		const before = await api(`/api/tenders/${tenderId}`, {}, admin);
		const r = await api(
			`/api/tenders/${tenderId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ title: "Licitacion Budget Editada", description: "Nueva desc" }),
			},
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.tender.title).toBe("Licitacion Budget Editada");
		expect(r.body.tender.description).toBe("Nueva desc");
		expect(r.body.tender.maxBudget).toBe(before.body.tender.maxBudget);
		expect(r.body.tender.status).toBe(before.body.tender.status);
	});

	it("editar campos de negocio vía PATCH es ignorado (solo title/description)", async () => {
		const before = await api(`/api/tenders/${tenderId}`, {}, admin);
		const r = await api(
			`/api/tenders/${tenderId}`,
			{
				method: "PATCH",
				body: JSON.stringify({ title: "Otro título", maxBudget: 999999, status: "collected" }),
			},
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.tender.title).toBe("Otro título");
		expect(r.body.tender.maxBudget).toBe(before.body.tender.maxBudget);
		expect(r.body.tender.status).toBe(before.body.tender.status);
	});

	it("editar licitación sin campos -> 400", async () => {
		const r = await api(`/api/tenders/${tenderId}`, { method: "PATCH", body: JSON.stringify({}) }, admin);
		expect(r.status).toBe(400);
	});

	it("editar licitación inexistente -> 404", async () => {
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
				body: JSON.stringify({ clientId, title: "Licitacion Upload", maxBudget: 1000, deadline }),
			},
			admin,
		);
		tenderId = r.body.tender.id;
	});

	it("subir archivo no-PDF -> rechazado", async () => {
		const form = new FormData();
		form.append("file", new Blob(["not a pdf"], { type: "text/plain" }), "notes.txt");
		const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
			method: "POST",
			headers: { Authorization: `Bearer ${admin}` },
			body: form,
		});
		expect([400, 422]).toContain(res.status);
	});

	it("subir PDF válido -> 200, descarga byte-exacta", async () => {
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
				body: JSON.stringify({ clientId, title: "Licitacion Lifecycle", maxBudget: 1000, deadline }),
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

	it("enviar con propuesta -> active", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("active");
	});

	it("reenviar (ya active) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
	});

	it("historial registra draft->active", async () => {
		const r = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		expect(r.body.history.some((h: any) => h.fromStatus === "draft" && h.toStatus === "active")).toBe(true);
	});

	it("agregar producto en active sigue permitido", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 0.5 }) },
			admin,
		);
		expect(r.status).toBe(201);
	});

	it("active -> for_collection (inválida) -> 422", async () => {
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

	it("productos bloqueados en finalized", async () => {
		const add = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		expect(add.status).toBe(422);
		const remove = await api(`/api/tenders/${tenderId}/products/${productId}`, { method: "DELETE" }, admin);
		expect(remove.status).toBe(422);
	});

	it("facturar con monto negativo -> rechazado", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: -5 }) },
			admin,
		);
		expect([400, 422]).toContain(r.status);
	});

	it("finalized -> for_collection vía invoice -> 200", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: 500 }) },
			admin,
		);
		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("for_collection");
		expect(r.body.tender.invoiceAmount).toBe("500.00");
	});

	it("for_collection -> lost (inválida) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/lost`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("INVALID_TENDER_TRANSITION");
	});

	it("pago negativo -> rechazado", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: -10 }) },
			admin,
		);
		expect([400, 422]).toContain(r.status);
	});

	it("pago parcial -> 201, balance correcto", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 300 }) },
			admin,
		);
		expect(r.status).toBe(201);
		expect(r.body.pendingBalance).toBe(200);
	});

	it("sobrepago -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 300 }) },
			admin,
		);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
	});

	it("pago final -> collected automático", async () => {
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

	it("pago post-collected -> 422", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 1 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});

	it("listar pagos -> 2 pagos", async () => {
		const r = await api(`/api/tenders/${tenderId}/payments`, {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.payments.length).toBe(2);
	});

	it("productos bloqueados en collected", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});

	it("historial completo tiene 4 transiciones", async () => {
		const r = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		expect(r.body.history.length).toBe(4);
	});

	it("auditoría: created_by/updated_by poblados en tenders y payments", async () => {
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
				body: JSON.stringify({ clientId, title: "Licitacion Pagos Decimales", maxBudget: 1000, deadline }),
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

	it("1000 pagado como 333.33 + 666.67 -> collected", async () => {
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

	it("lost -> finalized (inválida) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/finalize`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
	});

	it("lost -> active (inválida) -> 422", async () => {
		const r = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.code).toBe("INVALID_TENDER_TRANSITION");
	});

	it("productos bloqueados en lost", async () => {
		const r = await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId, quantity: 1 }) },
			admin,
		);
		expect(r.status).toBe(422);
	});
});

describe("dashboard", () => {
	it("sin auth -> 401", async () => {
		const r = await api("/api/dashboard");
		expect(r.status).toBe(401);
	});

	it("con auth -> 200, counts y upcoming", async () => {
		const r = await api("/api/dashboard", {}, admin);
		expect(r.status).toBe(200);
		expect(typeof r.body.counts).toBe("object");
		expect(Array.isArray(r.body.upcoming)).toBe(true);
	});
});

describe("validación de input", () => {
	it("licitación con datos inválidos -> 400", async () => {
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

	it("precio negativo -> VALIDATION_ERROR con el campo en el mensaje", async () => {
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

	it("pago en cero -> VALIDATION_ERROR", async () => {
		const r = await api(
			`/api/tenders/${crypto.randomUUID()}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 0 }) },
			admin,
		);
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
	});
});
