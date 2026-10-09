import { env, exports } from "cloudflare:workers";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { processExpiredTenders, processTenderReminders } from "../src/jobs/tenders";

const worker = exports.default;

async function api(path: string, init: RequestInit = {}, token?: string) {
	const headers = new Headers(init.headers);
	headers.set("Content-Type", "application/json");
	if (token) headers.set("Authorization", `Bearer ${token}`);
	const res = await worker.fetch(`http://localhost${path}`, { ...init, headers });
	return { status: res.status, body: await res.json() };
}

async function login(email: string, password: string) {
	const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
	return r.body.access_token as string;
}

async function uploadPdf(tenderId: string, token: string) {
	const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%%EOF");
	const form = new FormData();
	form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "p.pdf");
	await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
		body: form,
	});
}

let admin: string;
let clientId: string;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await api(
		"/api/clients",
		{
			method: "POST",
			body: JSON.stringify({ name: "Client Cron", companyName: "Acme", email: "delivered@resend.dev" }),
		},
		admin,
	);
	clientId = client.body.client.id;
});

async function createActiveTender(deadlineIso: string) {
	const create = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({ clientId, title: "Cron Fixture", maxBudget: 1000, deadline: deadlineIso }),
		},
		admin,
	);
	const tenderId = create.body.tender.id as string;
	await uploadPdf(tenderId, admin);
	await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
	return tenderId;
}

describe("processExpiredTenders", () => {
	it("active + expired deadline -> lost, with history changedBy=null", async () => {
		const tenderId = await createActiveTender(new Date(Date.now() + 60_000).toISOString());

		const sql = postgres(env.HYPERDRIVE.connectionString);
		await sql`update tenders set deadline = now() - interval '1 hour' where id = ${tenderId}`;
		await sql.end();

		await processExpiredTenders(env);

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("lost");

		const history = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		type HistoryEntry = { toStatus: string; changedBy: string | null };
		const autoTransition = (history.body.history as HistoryEntry[]).find((h) => h.toStatus === "lost");
		expect(autoTransition?.changedBy).toBeNull();
	});

	it("does not touch active tenders with a future deadline", async () => {
		const tenderId = await createActiveTender(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString());
		await processExpiredTenders(env);
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("active");
	});
});

describe("processTenderReminders", () => {
	it("active + <48h -> reminder_sent_at set; second run does not duplicate", async () => {
		const tenderId = await createActiveTender(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

		await processTenderReminders(env);
		const first = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(first.body.tender.reminderSentAt).not.toBeNull();

		const firstTimestamp = first.body.tender.reminderSentAt;
		await processTenderReminders(env);
		const second = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(second.body.tender.reminderSentAt).toBe(firstTimestamp);
	});

	it("does not send reminder if the deadline is more than 48h away", async () => {
		const tenderId = await createActiveTender(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString());
		await processTenderReminders(env);
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.reminderSentAt).toBeNull();
	});
});
