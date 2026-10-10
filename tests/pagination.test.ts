import { env } from "cloudflare:workers";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, login, uniqueName } from "./helpers";

let admin: string;
let clientId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await api(
		"/api/clients",
		{
			method: "POST",
			body: JSON.stringify({ name: "Pagination Client", companyName: "Acme", email: "delivered@resend.dev" }),
		},
		admin,
	);
	clientId = client.body.client.id;
});

const lists = [
	["tenders", "/api/tenders"],
	["clients", "/api/clients"],
	["products", "/api/products"],
	["users", "/api/users"],
] as const;

describe("pagination envelope (NFR-06)", () => {
	for (const [name, path] of lists) {
		it(`${name}: defaults to page 1, pageSize 20 and returns { data, page, pageSize, total } (NFR-06)`, async () => {
			const r = await api(path, {}, admin);
			expect(r.status).toBe(200);
			expect(Array.isArray(r.body.data)).toBe(true);
			expect(r.body.page).toBe(1);
			expect(r.body.pageSize).toBe(20);
			expect(typeof r.body.total).toBe("number");
			expect(r.body.data.length).toBeLessThanOrEqual(20);
		});

		it(`${name}: pageSize above 100 -> 400 VALIDATION_ERROR (NFR-06)`, async () => {
			const r = await api(`${path}?pageSize=101`, {}, admin);
			expect(r.status).toBe(400);
			expect(r.body.error.code).toBe("VALIDATION_ERROR");
		});

		it(`${name}: page 0 and pageSize 0 -> 400 VALIDATION_ERROR (NFR-06)`, async () => {
			expect((await api(`${path}?page=0`, {}, admin)).body.error.code).toBe("VALIDATION_ERROR");
			expect((await api(`${path}?pageSize=0`, {}, admin)).body.error.code).toBe("VALIDATION_ERROR");
		});

		it(`${name}: absurdly large page -> 400 VALIDATION_ERROR, not a 500 (NFR-06)`, async () => {
			const r = await api(`${path}?page=1e15`, {}, admin);
			expect(r.status).toBe(400);
			expect(r.body.error.code).toBe("VALIDATION_ERROR");
		});

		it(`${name}: pageSize 100 is accepted and echoed (NFR-06)`, async () => {
			const r = await api(`${path}?pageSize=100`, {}, admin);
			expect(r.status).toBe(200);
			expect(r.body.pageSize).toBe(100);
		});
	}
});

describe("clients and products lists (FR-36, FR-38)", () => {
	it("clients: pages are disjoint, newest first (FR-36, NFR-06)", async () => {
		const run = uniqueName("Order");
		for (let i = 0; i < 3; i++) {
			await api(
				"/api/clients",
				{
					method: "POST",
					body: JSON.stringify({ name: `${run} ${i}`, companyName: "Acme", email: "delivered@resend.dev" }),
				},
				admin,
			);
		}
		const first = await api("/api/clients?page=1&pageSize=2", {}, admin);
		const second = await api("/api/clients?page=2&pageSize=2", {}, admin);
		expect(first.body.data).toHaveLength(2);
		expect(first.body.total).toBeGreaterThanOrEqual(4);
		const ids = [...first.body.data, ...second.body.data].map((c: { id: string }) => c.id);
		expect(new Set(ids).size).toBe(ids.length);

		const created = [...first.body.data, ...second.body.data].map((c: { createdAt: string }) => c.createdAt);
		expect(created).toEqual([...created].sort().reverse());

		// Other test files create clients concurrently, so assert relative order, not position.
		const recent = await api("/api/clients?pageSize=100", {}, admin);
		const names = recent.body.data
			.map((c: { name: string }) => c.name)
			.filter((n: string) => n.startsWith(run));
		expect(names).toEqual([`${run} 2`, `${run} 1`, `${run} 0`]);
	});

	it("products: paginated, newest first (FR-38, NFR-06)", async () => {
		const run = uniqueName("Prod");
		for (const name of [`${run} A`, `${run} B`, `${run} C`]) {
			await api("/api/products", { method: "POST", body: JSON.stringify({ name, unitPrice: 10 }) }, admin);
		}
		const r = await api("/api/products?page=1&pageSize=2", {}, admin);
		expect(r.body.data).toHaveLength(2);
		// Other test files create products concurrently, so assert relative order, not position.
		const recent = await api("/api/products?pageSize=100", {}, admin);
		const names = recent.body.data
			.map((p: { name: string }) => p.name)
			.filter((n: string) => n.startsWith(run));
		expect(names).toEqual([`${run} C`, `${run} B`, `${run} A`]);
		expect(r.body.total).toBeGreaterThanOrEqual(3);
		const beyond = await api("/api/products?page=9999", {}, admin);
		expect(beyond.status).toBe(200);
		expect(beyond.body.data).toEqual([]);
		expect(beyond.body.total).toBeGreaterThanOrEqual(r.body.total);
	});

	it("users: paginated (NFR-06)", async () => {
		const r = await api("/api/users?pageSize=1", {}, admin);
		expect(r.body.data).toHaveLength(1);
		expect(r.body.total).toBeGreaterThanOrEqual(1);
	});
});

describe("tender list (FR-11, NFR-13)", () => {
	const SEEDED = 10_000;
	const sql = postgres(env.HYPERDRIVE.connectionString);

	beforeAll(async () => {
		await sql`
			insert into tenders (client_id, title, max_budget, deadline, status, created_at)
			select ${clientId}, 'Seed ' || n, 1000, now() + interval '30 days',
				(case when n % 4 = 0 then 'lost' else 'draft' end)::tender_status,
				now() - make_interval(secs => n)
			from generate_series(1, ${SEEDED}) as n`;
	}, 60_000);

	afterAll(async () => {
		await sql`delete from tenders where client_id = ${clientId}`;
		await sql.end();
	});

	it("filters by status and reports the filtered total (FR-11)", async () => {
		const r = await api("/api/tenders?status=lost&pageSize=100", {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.total).toBeGreaterThanOrEqual(SEEDED / 4);
		expect(r.body.data.every((t: { status: string }) => t.status === "lost")).toBe(true);
	});

	it("includes the client name so the SPA needs no client lookup (FR-11)", async () => {
		const r = await api("/api/tenders?pageSize=100", {}, admin);
		expect(r.body.data.length).toBeGreaterThan(0);
		for (const t of r.body.data) expect(typeof t.clientName).toBe("string");
		const seeded = r.body.data.find((t: { clientId: string }) => t.clientId === clientId);
		expect(seeded.clientName).toBe("Pagination Client");
	});

	it("rejects an unknown status (FR-11)", async () => {
		const r = await api("/api/tenders?status=bogus", {}, admin);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("is ordered newest first across pages (NFR-06)", async () => {
		const r = await api("/api/tenders?page=2&pageSize=100", {}, admin);
		const created = r.body.data.map((t: { createdAt: string }) => t.createdAt);
		expect(created).toHaveLength(100);
		expect(created).toEqual([...created].sort().reverse());
	});

	it(`responds under 500 ms p95 with ${SEEDED} tenders (NFR-13)`, async () => {
		const timings: number[] = [];
		for (let i = 0; i < 40; i++) {
			const start = performance.now();
			const r = await api(`/api/tenders?page=${(i % 5) + 1}&pageSize=100`, {}, admin);
			timings.push(performance.now() - start);
			expect(r.status).toBe(200);
			expect(r.body.total).toBeGreaterThanOrEqual(SEEDED);
		}
		timings.sort((a, b) => a - b);
		const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
		expect(p95).toBeLessThan(500);
	}, 60_000);
});
