import { beforeAll, describe, expect, it } from "vitest";
import { api, login, uniqueName, uploadPdf } from "./helpers";

// Test files run in parallel against the same database, so aggregates can move
// under our feet. Assertions are shape invariants or monotonic deltas, never exact totals.

let admin: string;
let viewer: string;

async function metrics(token = admin) {
	const r = await api("/api/dashboard/metrics", {}, token);
	expect(r.status).toBe(200);
	return r.body;
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const email = `viewer-dash-${Date.now()}@example.com`;
	await api(
		"/api/users",
		{ method: "POST", body: JSON.stringify({ email, password: "ViewerPass123!", role: "viewer" }) },
		admin,
	);
	viewer = await login(email, "ViewerPass123!");
});

describe("GET /api/dashboard/metrics", () => {
	it("no auth -> 401", async () => {
		const r = await api("/api/dashboard/metrics");
		expect(r.status).toBe(401);
	});

	it("viewer can read it", async () => {
		const body = await metrics(viewer);
		expect(body.success).toBe(true);
	});

	it("returns kpis, a 6-month series, every status and bounded activity", async () => {
		const body = await metrics();

		for (const kpi of [
			body.kpis.openPipeline.value,
			body.kpis.openPipeline.count,
			body.kpis.wonThisMonth.value,
			body.kpis.wonThisMonth.previousValue,
			body.kpis.outstanding.value,
			body.kpis.outstanding.count,
			body.kpis.overdue.count,
			body.kpis.overdue.value,
		]) {
			expect(typeof kpi).toBe("number");
			expect(kpi).toBeGreaterThanOrEqual(0);
		}

		expect(body.monthly).toHaveLength(6);
		const months = body.monthly.map((m: { month: string }) => m.month);
		expect(months).toEqual([...months].sort());
		expect(months.at(-1)).toBe(new Date().toISOString().slice(0, 7));
		expect(body.kpis.wonThisMonth.value).toBe(body.monthly.at(-1).won);

		expect(body.pipeline.map((p: { status: string }) => p.status)).toEqual([
			"draft",
			"active",
			"finalized",
			"for_collection",
			"collected",
			"lost",
		]);

		expect(body.activity.length).toBeLessThanOrEqual(8);
		const times = body.activity.map((a: { at: string }) => new Date(a.at).getTime());
		expect(times).toEqual([...times].sort((a, b) => b - a));
	});

	it("finalizing a tender raises won this month; a payment raises collected", async () => {
		const client = await api(
			"/api/clients",
			{
				method: "POST",
				body: JSON.stringify({ name: "Client Dash", companyName: "Acme", email: "delivered@resend.dev" }),
			},
			admin,
		);
		const product = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: uniqueName("Dash"), unitPrice: 300 }) },
			admin,
		);
		const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
		const create = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: client.body.client.id,
					title: "Dashboard Fixture",
					maxBudget: 1000,
					deadline,
				}),
			},
			admin,
		);
		const tenderId = create.body.tender.id as string;
		await api(
			`/api/tenders/${tenderId}/products`,
			{ method: "POST", body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }) },
			admin,
		);
		await uploadPdf(tenderId, admin);
		await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);

		const before = await metrics();
		await api(`/api/tenders/${tenderId}/finalize`, { method: "POST" }, admin);
		await api(
			`/api/tenders/${tenderId}/invoice`,
			{ method: "POST", body: JSON.stringify({ invoiceAmount: 300 }) },
			admin,
		);
		await api(
			`/api/tenders/${tenderId}/payments`,
			{ method: "POST", body: JSON.stringify({ amount: 100 }) },
			admin,
		);
		const after = await metrics();

		expect(after.kpis.wonThisMonth.value).toBeGreaterThanOrEqual(before.kpis.wonThisMonth.value + 300);
		expect(after.monthly.at(-1).collected).toBeGreaterThanOrEqual(before.monthly.at(-1).collected + 100);
		expect(after.activity.some((a: { tenderId: string }) => a.tenderId === tenderId)).toBe(true);
	});
});
