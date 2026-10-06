import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { payments } from "../../db/schema";
import { AppError } from "../../lib/errors";
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
	return db.transaction(async (tx) => {
		const [tender] = await tx.execute(
			sql`select id, status, invoice_amount from tenders where id = ${tenderId} for update`,
		);

		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
		}
		if (tender.status !== "for_collection") {
			throw new AppError(
				"BUSINESS_RULE_VIOLATION",
				"Payments can only be registered while the tender is in for_collection.",
			);
		}

		const invoiceAmount = Number(tender.invoice_amount ?? 0);

		const [paidRow] = await tx
			.select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)` })
			.from(payments)
			.where(eq(payments.tenderId, tenderId));
		const alreadyPaid = Number(paidRow?.paid ?? 0);
		const pendingBalance = invoiceAmount - alreadyPaid;

		if (amount <= 0) {
			throw new AppError("VALIDATION_ERROR", "Payment amount must be greater than zero.");
		}
		if (amount > pendingBalance) {
			throw new AppError("BUSINESS_RULE_VIOLATION", "Payment amount exceeds the pending balance.");
		}

		const [payment] = await tx
			.insert(payments)
			.values({
				tenderId,
				amount: amount.toFixed(2),
				reference: options.reference,
				notes: options.notes,
				createdBy: actorId,
			})
			.returning();

		const newBalance = pendingBalance - amount;
		if (newBalance === 0) {
			await transitionTender(tx as unknown as Database, tenderId, "collected", actorId);
		}

		return { payment, pendingBalance: newBalance };
	});
}
