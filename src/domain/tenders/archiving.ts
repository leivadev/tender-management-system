import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { reloadTender, type Tender, withLockedTender } from "./locking";
import type { TenderStatus } from "./state-machine";

// FR-44: only tenders that are not in flight can be archived.
const ARCHIVABLE_STATUSES: TenderStatus[] = ["draft", "collected", "lost"];

/**
 * FR-44, DAT-11: sets the archive marker. Status, history and proposal are untouched (FR-54).
 * An already archived tender is rejected by the lock itself (FR-47).
 */
export async function archiveTender(db: Database, tenderId: string, userId: string): Promise<Tender> {
	return withLockedTender(db, tenderId, async (tx, tender) => {
		if (!ARCHIVABLE_STATUSES.includes(tender.status as TenderStatus)) {
			throw new AppError(
				"BUSINESS_RULE_VIOLATION",
				`Cannot archive a tender in status ${tender.status}; only draft, collected or lost.`,
			);
		}
		await setArchiveMarker(tx, tenderId, { archivedAt: new Date(), archivedBy: userId }, userId);
		return reloadTender(tx, tenderId);
	});
}

/** FR-53: restoring ignores the client's archive state, which stays as it was. */
export async function restoreTender(db: Database, tenderId: string, userId: string): Promise<Tender> {
	return withLockedTender(
		db,
		tenderId,
		async (tx, tender) => {
			if (!tender.archivedAt) {
				throw new AppError("CONFLICT", "Tender is not archived.");
			}
			await setArchiveMarker(tx, tenderId, { archivedAt: null, archivedBy: null }, userId);
			return reloadTender(tx, tenderId);
		},
		{ allowArchived: true },
	);
}

async function setArchiveMarker(
	tx: Database,
	tenderId: string,
	marker: { archivedAt: Date | null; archivedBy: string | null },
	userId: string,
) {
	await tx
		.update(tenders)
		.set({ ...marker, updatedAt: new Date(), updatedBy: userId })
		.where(eq(tenders.id, tenderId));
}
