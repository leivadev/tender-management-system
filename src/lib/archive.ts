import { isNotNull, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { AuthedUser } from "../middleware/auth";

/** `archived` list parameter (FR-41). Absent means live records only. */
export const archivedQuery = z.object({
	archived: z.enum(["only", "include"]).optional(),
});

/**
 * Where-clause for the archive marker. Only an admin can see archived records; for any other
 * role the parameter is ignored and archived records are never returned (FR-41).
 */
export function archiveFilter(
	archivedAt: PgColumn,
	archived: "only" | "include" | undefined,
	role: AuthedUser["role"],
): SQL | undefined {
	if (role !== "admin" || archived === undefined) return isNull(archivedAt);
	return archived === "only" ? isNotNull(archivedAt) : undefined;
}
