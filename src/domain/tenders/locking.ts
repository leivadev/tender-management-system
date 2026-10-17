import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";

export type Tender = typeof tenders.$inferSelect;

/**
 * The single entry point for every operation that modifies a tender (BR-09):
 * opens one transaction, row-locks the tender (`SELECT ... FOR UPDATE`) and
 * hands `fn` the locked row plus a `db` bound to that transaction. Concurrent
 * requests and the scheduled job queue up on the lock, so each one validates
 * against the state the previous one committed.
 *
 * An archived tender is read-only (FR-47): the lock rejects it with 409 before `fn` runs, unless
 * the caller is the restore operation and passes `allowArchived`.
 *
 * `fn` must do every read-validate-write through the `tx` it receives.
 */
export async function withLockedTender<T>(
	db: Database,
	tenderId: string,
	fn: (tx: Database, tender: Tender) => Promise<T>,
	{ allowArchived = false }: { allowArchived?: boolean } = {},
): Promise<T> {
	return db.transaction(async (tx) => {
		const [tender] = await tx.select().from(tenders).where(eq(tenders.id, tenderId)).for("update");
		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
		}
		if (tender.archivedAt && !allowArchived) {
			throw new AppError("CONFLICT", "Tender is archived and read-only; restore it first.");
		}
		return fn(tx as unknown as Database, tender);
	});
}

/** Re-reads the tender through `tx` so the response reflects what this transaction wrote. */
export async function reloadTender(tx: Database, tenderId: string): Promise<Tender> {
	const [tender] = await tx.select().from(tenders).where(eq(tenders.id, tenderId));
	return tender as Tender;
}
