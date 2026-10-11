import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { clients, tenders } from "../db/schema";
import { withLockedTender } from "../domain/tenders/locking";
import { hoursRemaining, isWithinReminderWindow, REMINDER_WINDOW_HOURS } from "../domain/tenders/rules";
import { transitionTender } from "../domain/tenders/state-machine";
import { hoursFromNow } from "../lib/date";
import { sendReminderEmail } from "../services/email";

export async function processExpiredTenders(env: Env) {
	const db = getDb(env);

	const expired = await db
		.select({ id: tenders.id })
		.from(tenders)
		.where(and(eq(tenders.status, "active"), lt(tenders.deadline, new Date())));

	let expiredCount = 0;
	for (const candidate of expired) {
		// Re-check under the lock: a request may have moved the tender since the scan (BR-09).
		const moved = await withLockedTender(db, candidate.id, async (tx, tender) => {
			if (tender.status !== "active" || tender.deadline.getTime() >= Date.now()) return false;
			await transitionTender(tx, tender.id, "lost", null);
			return true;
		});
		if (moved) expiredCount++;
	}

	return { expiredCount };
}

export async function processTenderReminders(env: Env) {
	const db = getDb(env);

	const dueSoon = await db
		.select({ id: tenders.id })
		.from(tenders)
		.where(
			and(
				eq(tenders.status, "active"),
				gt(tenders.deadline, new Date()),
				lt(tenders.deadline, hoursFromNow(REMINDER_WINDOW_HOURS)),
				isNull(tenders.reminderSentAt),
			),
		);

	let sentCount = 0;
	for (const candidate of dueSoon) {
		try {
			// The email goes out under the lock and the marker is set only after it
			// succeeds: overlapping runs queue on the lock and see the marker (FR-30),
			// and a failed send leaves it unset so the next run retries (NFR-17).
			const sent = await withLockedTender(db, candidate.id, async (tx, tender) => {
				if (
					tender.status !== "active" ||
					tender.reminderSentAt !== null ||
					!isWithinReminderWindow(tender.deadline)
				) {
					return false;
				}

				const [client] = await tx.select().from(clients).where(eq(clients.id, tender.clientId));
				if (!client) return false;

				await sendReminderEmail(env, {
					title: tender.title,
					clientEmail: client.email,
					clientName: client.name,
					deadline: tender.deadline,
					hoursRemaining: hoursRemaining(tender.deadline),
				});
				await tx.update(tenders).set({ reminderSentAt: new Date() }).where(eq(tenders.id, tender.id));
				return true;
			});
			if (sent) sentCount++;
		} catch (error) {
			// One failing tender must not block the rest of the run (NFR-17).
			console.error(`Reminder for tender ${candidate.id} failed:`, error);
		}
	}

	return { sentCount };
}
