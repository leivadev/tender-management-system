import { beforeAll, describe, expect, it } from "vitest";
import wranglerConfig from "../wrangler.jsonc?raw";
import { api, login, uniqueName, uploadPdf } from "./helpers";

let admin: string;
let clientId: string;
let productId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await api(
		"/api/clients",
		{
			method: "POST",
			body: JSON.stringify({ name: "Client Req", companyName: "Acme", email: "delivered@resend.dev" }),
		},
		admin,
	);
	clientId = client.body.client.id;
	const product = await api(
		"/api/products",
		{ method: "POST", body: JSON.stringify({ name: uniqueName("Req Product"), price: 1234.56 }) },
		admin,
	);
	productId = product.body.product.id;
});

async function collectionTender(invoiceAmount: number) {
	const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
	const create = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({ clientId, title: uniqueName("Req Tender"), maxBudget: 50000, deadline }),
		},
		admin,
	);
	const id = create.body.tender.id as string;
	await api(
		`/api/tenders/${id}/products`,
		{ method: "POST", body: JSON.stringify({ productId, quantity: 3 }) },
		admin,
	);
	await uploadPdf(id, admin);
	await api(`/api/tenders/${id}/send`, { method: "POST" }, admin);
	await api(`/api/tenders/${id}/finalize`, { method: "POST" }, admin);
	await api(`/api/tenders/${id}/invoice`, { method: "POST", body: JSON.stringify({ invoiceAmount }) }, admin);
	return id;
}

describe("registering a payment is fast (NFR-14)", () => {
	it("responds under 1 s at the 95th percentile (NFR-14)", async () => {
		const id = await collectionTender(3703.68);
		const timings: number[] = [];
		for (let i = 0; i < 20; i++) {
			const start = performance.now();
			const r = await api(
				`/api/tenders/${id}/payments`,
				{ method: "POST", body: JSON.stringify({ amount: 17.37 }) },
				admin,
			);
			timings.push(performance.now() - start);
			expect(r.status).toBe(201);
		}
		timings.sort((a, b) => a - b);
		expect(timings[Math.ceil(timings.length * 0.95) - 1]).toBeLessThan(1000);
	}, 60_000);
});

describe("scheduled job cadence (NFR-15)", () => {
	it("the cron trigger fires at least once per hour (NFR-15)", () => {
		const match = wranglerConfig.match(/"crons"\s*:\s*\[([^\]]*)\]/);
		expect(match).not.toBeNull();
		const crons = [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
		expect(crons.length).toBeGreaterThan(0);
		// minute field fixed, hour field any: at most 60 minutes between runs.
		expect(
			crons.some((c) => /^\d+ \* \* \* \*$/.test(c) || /^\*\/([1-9]|[1-5]\d|60) \* \* \* \*$/.test(c)),
		).toBe(true);
	});
});

describe("timestamps are UTC (NFR-21)", () => {
	it("API timestamps are ISO 8601 in UTC so the client renders them in local time (NFR-21)", async () => {
		const id = await collectionTender(555.55);
		const { body } = await api(`/api/tenders/${id}`, {}, admin);
		const stamps = [
			body.tender.createdAt,
			body.tender.deadline,
			...body.tender.history.map((h: { createdAt: string }) => h.createdAt),
		];
		for (const s of stamps) expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
	});
});

describe("proposal storage is private (IF-03)", () => {
	it("the proposal is only served through the authenticated endpoint (IF-03)", async () => {
		const id = await collectionTender(100.01);
		const anon = await api(`/api/tenders/${id}/proposal/download`, {});
		expect(anon.status).toBe(401);
		const authed = await api(`/api/tenders/${id}/proposal/download`, {}, admin);
		expect(authed.status).toBe(200);
	});
});
