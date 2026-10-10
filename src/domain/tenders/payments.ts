import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { payments } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { withLockedTender } from "./locking";
import { fromCents, toCents } from "./money";
import { transitionTender } from "./state-machine";

/**
 * Registers a payment atomically: locks the tender row, validates status and
 * balance, inserts the payment, and — if the balance reaches zero — transitions
 * the tender to `collected`. Runs inside a single Postgres transaction to avoid
 * double-collection races with concurrent requests or the cron job.
 */
export async function registerPayment(
	db: Database,
	tenderId: string,
	amount: number,
	actorId: string | null,
	options: { reference?: string; notes?: string } = {},
) {
	return withLockedTender(db, tenderId, async (tx, tender) => {
		if (tender.status !== "for_collection") {
			throw new AppError(
				"BUSINESS_RULE_VIOLATION",
				"Payments can only be registered while the tender is in for_collection.",
			);
		}

		const invoiceCents = toCents(Number(tender.invoiceAmount ?? 0));

		const [paidRow] = await tx
			.select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)` })
			.from(payments)
			.where(eq(payments.tenderId, tenderId));
		const pendingCents = invoiceCents - toCents(Number(paidRow?.paid ?? 0));
		const amountCents = toCents(amount);

		if (amountCents <= 0) {
			throw new AppError("VALIDATION_ERROR", "Payment amount must be greater than zero.");
		}
		if (amountCents > pendingCents) {
			throw new AppError("BUSINESS_RULE_VIOLATION", "Payment amount exceeds the pending balance.");
		}

		const [payment] = await tx
			.insert(payments)
			.values({
				tenderId,
				amount: fromCents(amountCents).toFixed(2),
				reference: options.reference,
				notes: options.notes,
				createdBy: actorId,
			})
			.returning();

		const newBalanceCents = pendingCents - amountCents;
		if (newBalanceCents === 0) {
			await transitionTender(tx, tenderId, "collected", actorId);
		}

		return { payment, pendingBalance: fromCents(newBalanceCents) };
	});
}
