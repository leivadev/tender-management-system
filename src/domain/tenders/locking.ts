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
 * `fn` must do every read-validate-write through the `tx` it receives.
 */
export async function withLockedTender<T>(
	db: Database,
	tenderId: string,
	fn: (tx: Database, tender: Tender) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => {
		const [tender] = await tx.select().from(tenders).where(eq(tenders.id, tenderId)).for("update");
		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
		}
		return fn(tx as unknown as Database, tender);
	});
}

/** Re-reads the tender through `tx` so the response reflects what this transaction wrote. */
export async function reloadTender(tx: Database, tenderId: string): Promise<Tender> {
	const [tender] = await tx.select().from(tenders).where(eq(tenders.id, tenderId));
	return tender as Tender;
}
