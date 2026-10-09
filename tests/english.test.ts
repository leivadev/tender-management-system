import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { processTenderReminders } from "../src/jobs/tenders";
import { api, login, uniqueName, uploadPdf } from "./helpers";

type SentEmail = { subject: string; html: string; text: string };
const sentEmails = (globalThis as unknown as { __sentEmails: SentEmail[] }).__sentEmails;

// Accented letters, inverted punctuation, and common Spanish words used by the old copy.
const SPANISH = /[áéíóúñ¿¡]|licitaci|estimado|presupuesto|recordatorio|adjuntamos|cantidad|producto/i;

let admin: string;
let clientId: string;
let productId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await api(
		"/api/clients",
		{
			method: "POST",
			body: JSON.stringify({ name: "English Client", companyName: "Acme", email: "delivered@resend.dev" }),
		},
		admin,
	);
	clientId = client.body.client.id;
	const product = await api(
		"/api/products",
		{ method: "POST", body: JSON.stringify({ name: uniqueName("English Product"), unitPrice: 1234.5 }) },
		admin,
	);
	productId = product.body.product.id;
});

async function sendTender(title: string, deadlineIso: string) {
	const create = await api(
		"/api/tenders",
		{ method: "POST", body: JSON.stringify({ clientId, title, maxBudget: 5000, deadline: deadlineIso }) },
		admin,
	);
	const tenderId = create.body.tender.id as string;
	await api(
		`/api/tenders/${tenderId}/products`,
		{ method: "POST", body: JSON.stringify({ productId, quantity: 2 }) },
		admin,
	);
	await uploadPdf(tenderId, admin);
	const send = await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
	expect(send.status).toBe(200);
	return tenderId;
}

describe("English product language (NFR-25)", () => {
	it("tender email is in English, USD with two decimals, UTC date explicit (NFR-22, NFR-25)", async () => {
		sentEmails.length = 0;
		await sendTender("Email Language Tender", "2030-10-15T17:00:00.000Z");

		const email = sentEmails.at(-1);
		expect(email?.subject).toBe("Tender sent: Email Language Tender");
		for (const body of [email?.html, email?.text]) {
			expect(body).toContain("Dear English Client,");
			expect(body).toContain("$1,234.50");
			expect(body).toContain("$5,000.00");
			expect(body).toContain("October 15, 2030 at 5:00 PM UTC");
		}
		expect(`${email?.subject}${email?.html}${email?.text}`).not.toMatch(SPANISH);
	});

	it("reminder email is in English (NFR-25)", async () => {
		await sendTender("Reminder Language Tender", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
		sentEmails.length = 0;
		await processTenderReminders(env);

		const email = sentEmails.find((e) => e.subject.includes("Reminder Language Tender"));
		expect(email?.subject).toBe('Reminder: tender "Reminder Language Tender" is due soon');
		expect(`${email?.subject}${email?.html}${email?.text}`).not.toMatch(SPANISH);
	});

	it("a rejected operation returns an English message (NFR-25)", async () => {
		const create = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({
					clientId,
					title: "No Proposal",
					maxBudget: 1000,
					deadline: "2030-10-15T17:00:00.000Z",
				}),
			},
			admin,
		);
		const r = await api(`/api/tenders/${create.body.tender.id}/send`, { method: "POST" }, admin);
		expect(r.status).toBe(422);
		expect(r.body.error.message).not.toMatch(SPANISH);
	});
});
