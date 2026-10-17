import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { clients, tenders } from "../db/schema";
import { withLockedTender } from "../domain/tenders/locking";
import {
	hoursRemaining,
	isWithinReminderWindow,
	markReminderSent,
	REMINDER_WINDOW_HOURS,
} from "../domain/tenders/rules";
import { transitionTender } from "../domain/tenders/state-machine";
import { hoursFromNow } from "../lib/date";
import { logUnexpectedError } from "../lib/logging";
import { sendReminderEmail } from "../services/email";

export async function processExpiredTenders(env: Env) {
	const db = getDb(env);

	const expired = await db
		.select({ id: tenders.id })
		.from(tenders)
		.where(and(eq(tenders.status, "active"), lt(tenders.deadline, new Date()), isNull(tenders.archivedAt)));

	let expiredCount = 0;
	for (const candidate of expired) {
		try {
			// Re-check under the lock: a request may have moved the tender since the scan (BR-09).
			const moved = await withLockedTender(db, candidate.id, async (tx, tender) => {
				if (tender.status !== "active" || tender.deadline.getTime() >= Date.now()) return false;
				await transitionTender(tx, tender.id, "lost", null);
				return true;
			});
			if (moved) expiredCount++;
		} catch (error) {
			// One failing tender must not block the rest of the run (NFR-17).
			logUnexpectedError(error, { action: "expire-tender", tenderId: candidate.id });
		}
	}

	return { expiredCount };
}

export async function processTenderReminders(env: Env, { sendTimeoutMs = 10_000 } = {}) {
	const db = getDb(env);

	const candidates = await db
		.select({ id: tenders.id })
		.from(tenders)
		.where(
			and(
				eq(tenders.status, "active"),
				gt(tenders.deadline, new Date()),
				lt(tenders.deadline, hoursFromNow(REMINDER_WINDOW_HOURS)),
				isNull(tenders.reminderSentAt),
				isNull(tenders.archivedAt),
			),
		);

	let sentCount = 0;
	for (const candidate of candidates) {
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
					timeoutMs: sendTimeoutMs,
				});
				await markReminderSent(tx, tender.id);
				return true;
			});
			if (sent) sentCount++;
		} catch (error) {
			// One failing tender must not block the rest of the run (NFR-17).
			logUnexpectedError(error, { action: "remind-tender", tenderId: candidate.id });
		}
	}

	return { sentCount };
}
