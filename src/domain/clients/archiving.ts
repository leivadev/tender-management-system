import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "../../db/client";
import { clients, tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";

export type Client = typeof clients.$inferSelect;

// FR-48: a client with work in any of these statuses cannot be archived. Archived tenders are shelved, not open work.
const OPEN_STATUSES = ["draft", "active", "finalized", "for_collection"] as const;

/**
 * Locks the client row so archiving and tender creation serialise on it: archive takes the
 * exclusive lock, tender creation takes the shared one (see `assertClientSelectable`).
 */
async function lockClient(tx: Database, clientId: string, mode: "update" | "share"): Promise<Client> {
	const [client] = await tx.select().from(clients).where(eq(clients.id, clientId)).for(mode);
	if (!client) {
		throw new AppError("NOT_FOUND", `Client ${clientId} not found.`);
	}
	return client;
}

/** FR-42: a new tender may only be created for a live client. Call inside the creating transaction. */
export async function assertClientSelectable(tx: Database, clientId: string): Promise<void> {
	const client = await lockClient(tx, clientId, "share");
	if (client.archivedAt) {
		throw new AppError("BUSINESS_RULE_VIOLATION", "Archived clients cannot be used for new tenders.");
	}
}

/** FR-40, FR-48, DAT-11. Runs in its own transaction, locking the client against concurrent tender creation. */
export async function archiveClient(db: Database, clientId: string, userId: string): Promise<Client> {
	return db.transaction(async (tx) => {
		const database = tx as unknown as Database;
		const client = await lockClient(database, clientId, "update");
		if (client.archivedAt) {
			throw new AppError("CONFLICT", "Client is already archived.");
		}

		const [open] = await database
			.select({ n: count() })
			.from(tenders)
			.where(
				and(
					eq(tenders.clientId, clientId),
					inArray(tenders.status, [...OPEN_STATUSES]),
					isNull(tenders.archivedAt),
				),
			);
		if (open && open.n > 0) {
			throw new AppError(
				"CONFLICT",
				`Client has ${open.n} tender(s) in draft, active, finalized or for_collection; resolve them first.`,
			);
		}

		const now = new Date();
		const [archived] = await database
			.update(clients)
			.set({ archivedAt: now, archivedBy: userId, updatedAt: now, updatedBy: userId })
			.where(eq(clients.id, clientId))
			.returning();
		return archived as Client;
	});
}

/** FR-40, DAT-11: clears the marker and records the restorer as last modifier. */
export async function restoreClient(db: Database, clientId: string, userId: string): Promise<Client> {
	return db.transaction(async (tx) => {
		const database = tx as unknown as Database;
		const client = await lockClient(database, clientId, "update");
		if (!client.archivedAt) {
			throw new AppError("CONFLICT", "Client is not archived.");
		}

		const [restored] = await database
			.update(clients)
			.set({ archivedAt: null, archivedBy: null, updatedAt: new Date(), updatedBy: userId })
			.where(eq(clients.id, clientId))
			.returning();
		return restored as Client;
	});
}
