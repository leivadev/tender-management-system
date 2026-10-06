import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { tenderStatusHistory, tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";

export type TenderStatus = "draft" | "active" | "finalized" | "for_collection" | "collected" | "lost";

/**
 * Single source of truth for which transitions are allowed.
 * Any pair not listed here must be rejected.
 */
const VALID_TRANSITIONS: Record<TenderStatus, TenderStatus[]> = {
	draft: ["active"],
	active: ["finalized", "lost"],
	finalized: ["for_collection"],
	for_collection: ["collected"],
	collected: [],
	lost: [],
};

export function assertValidTransition(from: TenderStatus, to: TenderStatus) {
	const allowed = VALID_TRANSITIONS[from] ?? [];
	if (!allowed.includes(to)) {
		throw new AppError("INVALID_TENDER_TRANSITION", `Cannot transition tender from ${from} to ${to}.`);
	}
}

/**
 * The only function allowed to write tenders.status. Routes and jobs must
 * never run `UPDATE tenders SET status = ...` directly.
 *
 * Must be called with a `db` bound to an already-open transaction when the
 * caller also needs to touch other rows atomically (e.g. payments).
 */
export async function transitionTender(
	db: Database,
	tenderId: string,
	targetStatus: TenderStatus,
	actorId: string | null,
) {
	const [tender] = await db.select({ status: tenders.status }).from(tenders).where(eq(tenders.id, tenderId));

	if (!tender) {
		throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
	}

	const fromStatus = tender.status as TenderStatus;
	assertValidTransition(fromStatus, targetStatus);

	await db
		.update(tenders)
		.set({ status: targetStatus, updatedAt: new Date(), updatedBy: actorId })
		.where(eq(tenders.id, tenderId));

	await db.insert(tenderStatusHistory).values({
		tenderId,
		fromStatus,
		toStatus: targetStatus,
		changedBy: actorId,
	});

	return { fromStatus, toStatus: targetStatus };
}

// Per spec: only finalized/for_collection/collected/lost block product edits,
// so both draft and active remain editable.
export const EDITABLE_PRODUCT_STATUSES: TenderStatus[] = ["draft", "active"];

export function assertProductsEditable(status: TenderStatus) {
	if (!EDITABLE_PRODUCT_STATUSES.includes(status)) {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			`Cannot add or remove products while tender is in status ${status}.`,
		);
	}
}
