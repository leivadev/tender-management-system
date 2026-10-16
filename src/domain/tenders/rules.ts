import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { payments, tenderProducts, tenders } from "../../db/schema";
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

/** The proposal can be uploaded or replaced only while the tender is a draft (FR-34, FR-35). */
export function assertProposalEditable(status: TenderStatus) {
	if (status !== "draft") {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			`The proposal can only be uploaded or replaced while the tender is a draft (current status: ${status}).`,
		);
	}
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

export const REMINDER_WINDOW_HOURS = 48;
const REMINDER_WINDOW_MS = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;

/** True while fewer than 48 hours remain to a deadline still ahead of us (FR-26). */
export function isWithinReminderWindow(deadline: Date, now = Date.now()) {
	const remaining = deadline.getTime() - now;
	return remaining > 0 && remaining < REMINDER_WINDOW_MS;
}

/** Whole hours left, rounded down so the email never overstates; floor of 1 avoids "0 hours" (FR-26). */
export function hoursRemaining(deadline: Date, now = Date.now()) {
	return Math.max(1, Math.floor((deadline.getTime() - now) / (60 * 60 * 1000)));
}

/** Records the reminder as sent; call through the `tx` of `withLockedTender()` (FR-29, FR-30). */
export async function markReminderSent(tx: Database, tenderId: string) {
	await tx.update(tenders).set({ reminderSentAt: new Date() }).where(eq(tenders.id, tenderId));
}

/** FR-50: the invoiced amount can be corrected only in `for_collection` and before the first payment. */
export async function assertInvoiceCorrectable(db: Database, tender: Pick<Tender, "id" | "status">) {
	if (tender.status !== "for_collection") {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			"The invoiced amount can only be corrected while the tender is in for_collection.",
		);
	}
	const [firstPayment] = await db
		.select({ id: payments.id })
		.from(payments)
		.where(eq(payments.tenderId, tender.id))
		.limit(1);
	if (firstPayment) {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			"The invoiced amount cannot be corrected once a payment is registered.",
		);
	}
}
