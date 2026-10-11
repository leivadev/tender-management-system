import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { api, expireDeadline, futureDate, login, uniqueName, uploadPdf, worker } from "./helpers";
import type { SentEmail } from "./setup";

const sentEmails = (globalThis as unknown as { __sentEmails: SentEmail[] }).__sentEmails;
const resendStub = (globalThis as unknown as { __resendStub: { fail: boolean; network: boolean } })
	.__resendStub;

let admin: string;
let productId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const product = await api(
		"/api/products",
		{ method: "POST", body: JSON.stringify({ name: uniqueName("Send Product"), unitPrice: 10 }) },
		admin,
	);
	productId = product.body.product.id;
});

afterEach(() => {
	resendStub.fail = false;
	resendStub.network = false;
});

async function createClient(name = "Send Client") {
	const r = await api(
		"/api/clients",
		{ method: "POST", body: JSON.stringify({ name, companyName: "Acme", email: "delivered@resend.dev" }) },
		admin,
	);
	return r.body.client.id as string;
}

async function readyTender(opts: { title?: string; clientName?: string; productName?: string } = {}) {
	let pid = productId;
	if (opts.productName) {
		const p = await api(
			"/api/products",
			{ method: "POST", body: JSON.stringify({ name: opts.productName, unitPrice: 10 }) },
			admin,
		);
		pid = p.body.product.id;
	}
	const create = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({
				clientId: await createClient(opts.clientName),
				title: opts.title ?? "Send Tender",
				maxBudget: 1000,
				deadline: futureDate(),
			}),
		},
		admin,
	);
	const tenderId = create.body.tender.id as string;
	await api(
		`/api/tenders/${tenderId}/products`,
		{ method: "POST", body: JSON.stringify({ productId: pid, quantity: 1 }) },
		admin,
	);
	await uploadPdf(tenderId, admin);
	return tenderId;
}

const send = (tenderId: string) => api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
const history = async (tenderId: string) =>
	(await api(`/api/tenders/${tenderId}/history`, {}, admin)).body.history as unknown[];

describe("send: email first, then transition (FR-17, NFR-16)", () => {
	it("email provider failure -> 502 EMAIL_DELIVERY_FAILED, stays draft, no history (NFR-16)", async () => {
		const tenderId = await readyTender();
		const before = (await history(tenderId)).length;
		resendStub.fail = true;

		const r = await send(tenderId);

		expect(r.status).toBe(502);
		expect(r.body.error.code).toBe("EMAIL_DELIVERY_FAILED");
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("draft");
		expect((await history(tenderId)).length).toBe(before);
	});

	it("network-level provider failure -> 502 EMAIL_DELIVERY_FAILED, stays draft (NFR-16)", async () => {
		const tenderId = await readyTender();
		resendStub.network = true;

		const r = await send(tenderId);

		expect(r.status).toBe(502);
		expect(r.body.error.code).toBe("EMAIL_DELIVERY_FAILED");
		expect((await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender.status).toBe("draft");
	});

	it("a failed send can be retried and then succeeds (NFR-16)", async () => {
		const tenderId = await readyTender();
		resendStub.fail = true;
		expect((await send(tenderId)).status).toBe(502);

		resendStub.fail = false;
		const retry = await send(tenderId);

		expect(retry.status).toBe(200);
		expect(retry.body.tender.status).toBe("active");
	});

	it("a deadline not in the future sends no email and stays draft (FR-17, BR-15)", async () => {
		const tenderId = await readyTender();
		await expireDeadline(tenderId);
		sentEmails.length = 0;

		const r = await send(tenderId);

		expect(r.status).toBe(422);
		expect(sentEmails).toHaveLength(0);
		expect((await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender.status).toBe("draft");
	});

	it("a missing proposal sends no email (FR-17, BR-03)", async () => {
		const create = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({
					clientId: await createClient(),
					title: "No Proposal",
					maxBudget: 1000,
					deadline: futureDate(),
				}),
			},
			admin,
		);
		sentEmails.length = 0;

		const r = await send(create.body.tender.id);

		expect(r.status).toBe(422);
		expect(sentEmails).toHaveLength(0);
	});

	it("success sends one email and transitions to active (FR-17)", async () => {
		const tenderId = await readyTender();
		sentEmails.length = 0;

		const r = await send(tenderId);

		expect(r.status).toBe(200);
		expect(r.body.tender.status).toBe("active");
		expect(sentEmails).toHaveLength(1);
	});
});

describe("send: email content (FR-25, NFR-28)", () => {
	it("summarises products, budget and deadline and attaches the proposal (FR-25)", async () => {
		const productName = uniqueName("Summary Product");
		const tenderId = await readyTender({ productName });
		sentEmails.length = 0;
		await send(tenderId);

		const email = sentEmails[0];
		expect(email.html).toContain(productName);
		expect(email.html).toContain("$1,000.00");
		expect(email.html).toContain("UTC");
		expect(email.attachments?.map((a) => a.filename)).toEqual(["proposal.pdf"]);
		expect(email.attachments?.[0].content.length).toBeGreaterThan(0);
	});

	it("uses the fixed sender and sets no Reply-To (NFR-28)", async () => {
		const tenderId = await readyTender();
		sentEmails.length = 0;
		await send(tenderId);

		const email = sentEmails[0];
		expect(email.from).toContain("noreply@leivadev.com");
		expect(email).not.toHaveProperty("reply_to");
	});
});

describe("send: HTML escaping (FR-27)", () => {
	const payload = '<img src=x onerror="alert(1)">';

	it("escapes title, client name and product name in the HTML body (FR-27)", async () => {
		const tenderId = await readyTender({
			title: `T ${payload}`,
			clientName: `C ${payload}`,
			productName: `${uniqueName("P")} ${payload}`,
		});
		sentEmails.length = 0;
		await send(tenderId);

		const { html, text } = sentEmails[0];
		expect(html).not.toContain(payload);
		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
		// The plain-text part is not HTML: values stay verbatim.
		expect(text).toContain(payload);
	});

	it("escapes the proposal file name (FR-27)", async () => {
		const tenderId = await readyTender();
		const form = new FormData();
		form.append(
			"file",
			new Blob([new TextEncoder().encode("%PDF-1.4\n%%EOF")], { type: "application/pdf" }),
			"<b>x</b>.pdf",
		);
		const up = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
			method: "POST",
			headers: { Authorization: `Bearer ${admin}` },
			body: form,
		});
		expect(up.status).toBe(200);
		sentEmails.length = 0;
		await send(tenderId);

		expect(sentEmails[0].html).not.toContain("<b>x</b>");
		expect(sentEmails[0].html).toContain("&lt;b&gt;x&lt;/b&gt;.pdf");
	});
});

describe("send: error contract (OpenAPI)", () => {
	it("documents the 502 EMAIL_DELIVERY_FAILED response on the send operation", async () => {
		const { body: spec } = await api("/openapi.json");
		const op = spec.paths["/api/tenders/{id}/send"].post;
		expect(op.responses["502"]).toBeDefined();
		expect(JSON.stringify(op.responses["502"])).toContain("EMAIL_DELIVERY_FAILED");
	});
});
