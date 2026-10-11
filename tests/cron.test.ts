import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { processExpiredTenders, processTenderReminders } from "../src/jobs/tenders";
import { api, clearReminder, expireDeadline, login, setDeadlineIn, uniqueName, uploadPdf } from "./helpers";
import type { SentEmail } from "./setup";

const sentEmails = (globalThis as unknown as { __sentEmails: SentEmail[] }).__sentEmails;
const resendStub = (
	globalThis as unknown as { __resendStub: { fail: boolean; network: boolean; hang: boolean } }
).__resendStub;

const HOUR = 60 * 60 * 1000;

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

afterEach(() => {
	resendStub.fail = false;
	resendStub.network = false;
	resendStub.hang = false;
});

async function createActiveTender(deadlineIso: string, title = uniqueName("Cron Fixture")) {
	const create = await api(
		"/api/tenders",
		{
			method: "POST",
			body: JSON.stringify({ clientId, title, maxBudget: 1000, deadline: deadlineIso }),
		},
		admin,
	);
	const tenderId = create.body.tender.id as string;
	await uploadPdf(tenderId, admin);
	await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin);
	return { tenderId, title };
}

const remindersFor = (title: string) =>
	sentEmails.filter((e) => e.subject.startsWith("Reminder") && e.subject.includes(title));

const reminderSentAt = async (tenderId: string) =>
	(await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender.reminderSentAt as string | null;

describe("processExpiredTenders", () => {
	it("active + expired deadline -> lost, with history changedBy=null (FR-28)", async () => {
		const { tenderId } = await createActiveTender(new Date(Date.now() + 60_000).toISOString());
		await expireDeadline(tenderId);

		await processExpiredTenders(env);

		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("lost");

		const history = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		type HistoryEntry = { toStatus: string; changedBy: string | null };
		const autoTransition = (history.body.history as HistoryEntry[]).find((h) => h.toStatus === "lost");
		expect(autoTransition?.changedBy).toBeNull();
	});

	it("does not touch active tenders with a future deadline (FR-28)", async () => {
		const { tenderId } = await createActiveTender(new Date(Date.now() + 5 * 24 * HOUR).toISOString());
		await processExpiredTenders(env);
		const detail = await api(`/api/tenders/${tenderId}`, {}, admin);
		expect(detail.body.tender.status).toBe("active");
	});

	it("repeated and overlapping runs record a single transition (FR-30)", async () => {
		const { tenderId } = await createActiveTender(new Date(Date.now() + 60_000).toISOString());
		await expireDeadline(tenderId);

		await Promise.all([processExpiredTenders(env), processExpiredTenders(env)]);
		await processExpiredTenders(env);

		const history = await api(`/api/tenders/${tenderId}/history`, {}, admin);
		const lost = (history.body.history as { toStatus: string }[]).filter((h) => h.toStatus === "lost");
		expect(lost).toHaveLength(1);
	});
});

describe("processTenderReminders", () => {
	it("active + <48h -> one reminder with title, deadline and hours remaining, no attachment (FR-26)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());
		await clearReminder(tenderId);

		const result = await processTenderReminders(env);

		expect(result.sentCount).toBeGreaterThanOrEqual(1);
		const emails = remindersFor(title);
		expect(emails).toHaveLength(1);
		const [email] = emails;
		expect(email.to).toEqual(["delivered@resend.dev"]);
		expect(email.text).toContain(title);
		expect(email.text).toMatch(/2[34] hours/);
		expect(email.text).toMatch(/UTC/);
		expect(email.html).toContain("UTC");
		expect(email.attachments ?? []).toHaveLength(0);
		expect(await reminderSentAt(tenderId)).not.toBeNull();
	});

	it("does not send a reminder if the deadline is more than 48h away (FR-26)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 5 * 24 * HOUR).toISOString());
		await processTenderReminders(env);
		expect(remindersFor(title)).toHaveLength(0);
		expect(await reminderSentAt(tenderId)).toBeNull();
	});

	it("provider failure leaves the marker unset; the next run retries (NFR-17)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());
		await clearReminder(tenderId);

		resendStub.fail = true;
		await processTenderReminders(env);
		expect(await reminderSentAt(tenderId)).toBeNull();
		expect(remindersFor(title)).toHaveLength(0);

		resendStub.fail = false;
		await processTenderReminders(env);
		expect(await reminderSentAt(tenderId)).not.toBeNull();
		expect(remindersFor(title)).toHaveLength(1);
	});

	it("network failure leaves the marker unset (NFR-17)", async () => {
		const { tenderId } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());
		await clearReminder(tenderId);

		resendStub.network = true;
		await processTenderReminders(env);
		expect(await reminderSentAt(tenderId)).toBeNull();
	});

	it("a failed run marks no tender; the next run reminds each exactly once (NFR-17)", async () => {
		const a = await createActiveTender(new Date(Date.now() + 20 * HOUR).toISOString());
		const b = await createActiveTender(new Date(Date.now() + 30 * HOUR).toISOString());
		await clearReminder(a.tenderId);
		await clearReminder(b.tenderId);
		resendStub.fail = true;
		await processTenderReminders(env);
		resendStub.fail = false;
		await processTenderReminders(env);

		expect(remindersFor(a.title)).toHaveLength(1);
		expect(remindersFor(b.title)).toHaveLength(1);
	});

	it("repeated runs do not duplicate the email (FR-30)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());
		await clearReminder(tenderId);

		await processTenderReminders(env);
		const firstTimestamp = await reminderSentAt(tenderId);
		await processTenderReminders(env);

		expect(await reminderSentAt(tenderId)).toBe(firstTimestamp);
		expect(remindersFor(title)).toHaveLength(1);
	});

	it("overlapping runs send exactly one email (FR-30)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());
		await clearReminder(tenderId);

		await Promise.all([processTenderReminders(env), processTenderReminders(env)]);

		expect(remindersFor(title)).toHaveLength(1);
		expect(await reminderSentAt(tenderId)).not.toBeNull();
	});

	it("states whole hours rounded down: 47.5h left -> 47 hours (FR-26)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 5 * 24 * HOUR).toISOString());
		await setDeadlineIn(tenderId, 47.5 * HOUR);

		await processTenderReminders(env);

		expect(remindersFor(title)[0].text).toMatch(/in 47 hours from now/);
	});

	it("uses the singular for the last hour (FR-26)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 5 * 24 * HOUR).toISOString());
		await setDeadlineIn(tenderId, 30 * 60_000);

		await processTenderReminders(env);

		expect(remindersFor(title)[0].text).toMatch(/in 1 hour from now/);
	});

	it("a hung provider times out, leaves the marker unset and frees the lock (NFR-17)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());
		await clearReminder(tenderId);

		resendStub.hang = true;
		await processTenderReminders(env, { sendTimeoutMs: 100 });
		expect(await reminderSentAt(tenderId)).toBeNull();

		resendStub.hang = false;
		await processTenderReminders(env);
		expect(remindersFor(title)).toHaveLength(1);
	});

	it("skips a tender whose deadline already passed (FR-26, FR-28)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 60_000).toISOString());
		await clearReminder(tenderId);
		await expireDeadline(tenderId);

		await processTenderReminders(env);

		expect(remindersFor(title)).toHaveLength(0);
	});
});

describe("send with <48h remaining (FR-29)", () => {
	it("marks the reminder as already sent and the job sends none (FR-26, FR-29)", async () => {
		const { tenderId, title } = await createActiveTender(new Date(Date.now() + 24 * HOUR).toISOString());

		expect(await reminderSentAt(tenderId)).not.toBeNull();
		await processTenderReminders(env);
		expect(remindersFor(title)).toHaveLength(0);
	});

	it("a failed send leaves the draft without a marker; the retry sets it (FR-29, NFR-16)", async () => {
		const create = await api(
			"/api/tenders",
			{
				method: "POST",
				body: JSON.stringify({
					clientId,
					title: uniqueName("Failed Send"),
					maxBudget: 1000,
					deadline: new Date(Date.now() + 24 * HOUR).toISOString(),
				}),
			},
			admin,
		);
		const tenderId = create.body.tender.id as string;
		await uploadPdf(tenderId, admin);

		resendStub.fail = true;
		expect((await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin)).status).toBe(502);
		expect(await reminderSentAt(tenderId)).toBeNull();

		resendStub.fail = false;
		expect((await api(`/api/tenders/${tenderId}/send`, { method: "POST" }, admin)).status).toBe(200);
		expect(await reminderSentAt(tenderId)).not.toBeNull();
	});

	it("leaves the marker unset when 48h or more remain (FR-29)", async () => {
		const { tenderId } = await createActiveTender(new Date(Date.now() + 5 * 24 * HOUR).toISOString());
		expect(await reminderSentAt(tenderId)).toBeNull();
	});
});
