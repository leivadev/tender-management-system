import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { tenderProducts } from "../../db/schema";
import { AppError } from "../../lib/errors";
import type { Tender } from "./locking";
import { toCents } from "./money";
import type { TenderStatus } from "./state-machine";

export async function getTenderTotal(db: Database, tenderId: string) {
	const [row] = await db
		.select({
			total: sql<string>`coalesce(sum(${tenderProducts.subtotal}), 0)`,
		})
		.from(tenderProducts)
		.where(eq(tenderProducts.tenderId, tenderId));

	return Number(row?.total ?? 0);
}

export async function assertWithinBudget(
	db: Database,
	tenderId: string,
	maxBudget: number,
	newSubtotal: number,
) {
	const currentTotal = await getTenderTotal(db, tenderId);
	// Compare in whole cents: 0.10 + 0.20 > 0.30 in binary floating point (BR-06).
	if (toCents(currentTotal) + toCents(newSubtotal) > toCents(maxBudget)) {
		throw new AppError("TENDER_BUDGET_EXCEEDED", "The tender total exceeds the maximum budget.");
	}
}

export function assertHasProposal(tender: Pick<Tender, "proposalKey">) {
	if (!tender.proposalKey) {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			"Tender cannot be sent without an uploaded proposal document.",
		);
	}

	return tender.proposalKey;
}

/** New budget must still cover the lines already in the tender (FR-43, BR-01). */
export async function assertBudgetCoversLines(db: Database, tenderId: string, newBudget: number) {
	const currentTotal = await getTenderTotal(db, tenderId);
	if (toCents(currentTotal) > toCents(newBudget)) {
		throw new AppError(
			"TENDER_BUDGET_EXCEEDED",
			"The new maximum budget is lower than the current sum of the tender's lines.",
		);
	}
}

/** Budget and deadline change only while the tender is a draft (BR-10). */
export function assertBudgetAndDeadlineEditable(status: TenderStatus) {
	if (status !== "draft") {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			`Maximum budget and deadline can only be changed while the tender is a draft (current status: ${status}).`,
		);
	}
}

/** Sending requires a deadline still ahead of us (BR-15). */
export function assertDeadlineInFuture(deadline: Date) {
	if (deadline.getTime() <= Date.now()) {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			"Tender cannot be sent: its deadline is not in the future.",
		);
	}
}
