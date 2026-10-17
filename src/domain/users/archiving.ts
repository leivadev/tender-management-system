import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { profiles } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { setAuthUserBanned } from "../../services/auth";

export type Profile = typeof profiles.$inferSelect;
type Role = Profile["role"];

/**
 * FR-05: locks every non-archived admin row, in id order so concurrent callers cannot deadlock.
 * Demoting and archiving both call this first, so two requests can never each see "another admin
 * remains" and remove the last two. NO KEY UPDATE still excludes other callers of this lock but lets
 * foreign-key checks on admin ids (`created_by`, `updated_by`...) through, so the slow provider call in
 * `archiveUser` does not stall every other admin's writes.
 */
async function lockLiveAdmins(tx: Database): Promise<string[]> {
	const rows = await tx
		.select({ id: profiles.id })
		.from(profiles)
		.where(and(eq(profiles.role, "admin"), isNull(profiles.archivedAt)))
		.orderBy(asc(profiles.id))
		.for("no key update");
	return rows.map((r) => r.id);
}

async function lockUser(tx: Database, id: string): Promise<Profile> {
	const [profile] = await tx.select().from(profiles).where(eq(profiles.id, id)).for("update");
	if (!profile) {
		throw new AppError("NOT_FOUND", `User ${id} not found.`);
	}
	return profile;
}

/** FR-52: an admin cannot act on their own account in these ways; another admin must. */
function assertNotSelf(id: string, actorId: string, what: string) {
	if (id === actorId) {
		throw new AppError("CONFLICT", `You cannot ${what} your own account; ask another administrator.`);
	}
}

/** FR-05: `target` may only stop being a live admin if some other live admin remains. */
function assertAnotherAdminRemains(liveAdmins: string[], target: Profile, what: string) {
	if (target.role === "admin" && !target.archivedAt && !liveAdmins.some((id) => id !== target.id)) {
		throw new AppError("CONFLICT", `The last administrator cannot be ${what}.`);
	}
}

/** FR-33, FR-52, FR-05. Runs in its own transaction. */
export async function changeUserRole(
	db: Database,
	id: string,
	role: Role,
	actorId: string,
): Promise<Profile> {
	return db.transaction(async (tx) => {
		const database = tx as unknown as Database;
		assertNotSelf(id, actorId, "change the role of");
		const liveAdmins = await lockLiveAdmins(database);
		const target = await lockUser(database, id);
		if (target.archivedAt) {
			throw new AppError("CONFLICT", "Restore the user before changing their role.");
		}
		if (role !== "admin") {
			assertAnotherAdminRemains(liveAdmins, target, "demoted");
		}

		const [updated] = await database
			.update(profiles)
			.set({ role, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(profiles.id, id))
			.returning();
		return updated as Profile;
	});
}

/**
 * FR-40, FR-51, FR-52, FR-05, DAT-11. Marks the profile, drops the user's sessions (their refresh
 * tokens go with them) and bans them at the provider in one transaction: if the ban fails the
 * profile change rolls back. If the commit itself fails after a successful ban the user is banned but
 * not archived; retrying the archive heals that.
 */
export async function archiveUser(db: Database, env: Env, id: string, actorId: string): Promise<Profile> {
	return db.transaction(async (tx) => {
		const database = tx as unknown as Database;
		assertNotSelf(id, actorId, "archive");
		const liveAdmins = await lockLiveAdmins(database);
		const target = await lockUser(database, id);
		if (target.archivedAt) {
			throw new AppError("CONFLICT", "User is already archived.");
		}
		assertAnotherAdminRemains(liveAdmins, target, "archived");

		const now = new Date();
		const [archived] = await database
			.update(profiles)
			.set({ archivedAt: now, archivedBy: actorId, updatedAt: now, updatedBy: actorId })
			.where(eq(profiles.id, id))
			.returning();
		// Cascades to auth.refresh_tokens.
		await database.execute(sql`delete from auth.sessions where user_id = ${id}`);
		await setAuthUserBanned(env, id, true);
		return archived as Profile;
	});
}

/** FR-51, DAT-11: lifts the ban and clears the marker; the role was never touched. */
export async function restoreUser(db: Database, env: Env, id: string, actorId: string): Promise<Profile> {
	return db.transaction(async (tx) => {
		const database = tx as unknown as Database;
		const target = await lockUser(database, id);
		if (!target.archivedAt) {
			throw new AppError("CONFLICT", "User is not archived.");
		}

		const [restored] = await database
			.update(profiles)
			.set({ archivedAt: null, archivedBy: null, updatedAt: new Date(), updatedBy: actorId })
			.where(eq(profiles.id, id))
			.returning();
		await setAuthUserBanned(env, id, false);
		return restored as Profile;
	});
}
