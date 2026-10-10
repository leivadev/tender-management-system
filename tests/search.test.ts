import { beforeAll, describe, expect, it } from "vitest";
import { api, login, uniqueName } from "./helpers";

// Every fixture carries a unique token, so `q` assertions are exact even though other
// test files share the database.

let admin: string;
const token = `Zq${Date.now().toString(36)}`;
let clientId: string;
const tenderIds: Record<string, string> = {};

async function createTender(title: string, maxBudget: number, deadlineDays: number) {
	const r = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({
				clientId,
				title,
				maxBudget,
				deadline: new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString(),
			}),
		},
		admin,
	);
	expect(r.status).toBe(201);
	return r.body.tender.id as string;
}

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await api(
		"/api/clients",
		{
			method: "POST",
			body: JSON.stringify({
				name: `${token} Buyer`,
				companyName: "Search Co",
				email: "delivered@resend.dev",
			}),
		},
		admin,
	);
	clientId = client.body.client.id;
	tenderIds.a = await createTender(`${token} Alpha`, 3000, 30);
	tenderIds.b = await createTender(`${token} Bravo`, 1000, 10);
	tenderIds.c = await createTender(`${token} Charlie`, 2000, 20);
});

const titles = (r: { body: { data: { title: string }[] } }) => r.body.data.map((t) => t.title);

describe("tender search and sort", () => {
	it("q matches the title, case-insensitively", async () => {
		const r = await api(`/api/tenders?q=${token.toLowerCase()}%20alpha`, {}, admin);
		expect(r.status).toBe(200);
		expect(titles(r)).toEqual([`${token} Alpha`]);
		expect(r.body.total).toBe(1);
	});

	it("q also matches the client name", async () => {
		const r = await api(`/api/tenders?q=${token}%20Buyer&pageSize=100`, {}, admin);
		expect(r.body.total).toBe(3);
		expect(r.body.data.every((t: { clientId: string }) => t.clientId === clientId)).toBe(true);
	});

	it("LIKE wildcards in q are literal", async () => {
		const r = await api("/api/tenders?q=%25", {}, admin);
		expect(r.status).toBe(200);
		expect(r.body.data.every((t: { title: string }) => t.title.includes("%"))).toBe(true);
	});

	it("q combines with the status filter", async () => {
		const r = await api(`/api/tenders?q=${token}&status=active`, {}, admin);
		expect(r.body.total).toBe(0);
		const drafts = await api(`/api/tenders?q=${token}&status=draft`, {}, admin);
		expect(drafts.body.total).toBe(3);
	});

	it("sorts by budget in both directions", async () => {
		const asc = await api(`/api/tenders?q=${token}&sort=budget&dir=asc`, {}, admin);
		expect(titles(asc)).toEqual([`${token} Bravo`, `${token} Charlie`, `${token} Alpha`]);
		const desc = await api(`/api/tenders?q=${token}&sort=budget&dir=desc`, {}, admin);
		expect(titles(desc)).toEqual([`${token} Alpha`, `${token} Charlie`, `${token} Bravo`]);
	});

	it("sorts by deadline and by title", async () => {
		const byDeadline = await api(`/api/tenders?q=${token}&sort=deadline&dir=asc`, {}, admin);
		expect(titles(byDeadline)).toEqual([`${token} Bravo`, `${token} Charlie`, `${token} Alpha`]);
		const byTitle = await api(`/api/tenders?q=${token}&sort=title&dir=asc`, {}, admin);
		expect(titles(byTitle)).toEqual([`${token} Alpha`, `${token} Bravo`, `${token} Charlie`]);
	});

	it("rejects an unknown sort key and an over-long q", async () => {
		const bad = await api("/api/tenders?sort=bogus", {}, admin);
		expect(bad.body.error.code).toBe("VALIDATION_ERROR");
		const long = await api(`/api/tenders?q=${"x".repeat(101)}`, {}, admin);
		expect(long.body.error.code).toBe("VALIDATION_ERROR");
	});
});

describe("client and product search", () => {
	it("clients: q matches name, company or email", async () => {
		const byName = await api(`/api/clients?q=${token}`, {}, admin);
		expect(byName.body.total).toBe(1);
		const byCompany = await api("/api/clients?q=search%20co&pageSize=100", {}, admin);
		expect(byCompany.body.data.some((c: { id: string }) => c.id === clientId)).toBe(true);
	});

	it("products: q matches the name", async () => {
		const name = uniqueName(`${token} Gadget`);
		await api("/api/products", { method: "POST", body: JSON.stringify({ name, unitPrice: 5 }) }, admin);
		const r = await api(`/api/products?q=${encodeURIComponent(name)}`, {}, admin);
		expect(r.body.total).toBe(1);
		expect(r.body.data[0].name).toBe(name);
	});

	it("users ignore q (admin-only list stays unfiltered)", async () => {
		const r = await api("/api/users?q=zzzz-no-match", {}, admin);
		expect(r.status).toBe(200);
	});
});
