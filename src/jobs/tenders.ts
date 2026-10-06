import { and, eq, gt, isNull, lt, lte } from "drizzle-orm";
import { getDb } from "../db/client";
import { clients, tenders } from "../db/schema";
import { transitionTender } from "../domain/tenders/state-machine";
import { hoursFromNow } from "../lib/date";
import { sendReminderEmail } from "../services/email";

export async function processExpiredTenders(env: Env) {
	const db = getDb(env);

	const expired = await db
		.select({ id: tenders.id })
		.from(tenders)
		.where(and(eq(tenders.status, "active"), lt(tenders.deadline, new Date())));

	for (const tender of expired) {
		await transitionTender(db, tender.id, "lost", null);
	}

	return { expiredCount: expired.length };
}

export async function processTenderReminders(env: Env) {
	const db = getDb(env);
	const in48h = hoursFromNow(48);

	const dueSoon = await db
		.select({
			id: tenders.id,
			title: tenders.title,
			deadline: tenders.deadline,
			clientEmail: clients.email,
			clientName: clients.name,
		})
		.from(tenders)
		.innerJoin(clients, eq(tenders.clientId, clients.id))
		.where(
			and(
				eq(tenders.status, "active"),
				gt(tenders.deadline, new Date()),
				lte(tenders.deadline, in48h),
				isNull(tenders.reminderSentAt),
			),
		);

	let sentCount = 0;
	for (const tender of dueSoon) {
		// Atomic guard: only the first writer wins if this runs concurrently.
		const updated = await db
			.update(tenders)
			.set({ reminderSentAt: new Date() })
			.where(and(eq(tenders.id, tender.id), isNull(tenders.reminderSentAt)))
			.returning({ id: tenders.id });

		if (updated.length === 0) continue;

		await sendReminderEmail(env, {
			title: tender.title,
			clientEmail: tender.clientEmail,
			clientName: tender.clientName,
			deadline: tender.deadline,
		});
		sentCount++;
	}

	return { sentCount };
}
