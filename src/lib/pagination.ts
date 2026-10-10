import { count, desc, ilike, or, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Database } from "../db/client";

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
// Keeps (page - 1) * pageSize far inside Postgres OFFSET range.
export const MAX_PAGE = 1_000_000;

export const paginationQuery = z.object({
	page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
	pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type Pagination = z.infer<typeof paginationQuery>;

/** Optional free-text search, shared by the list endpoints that support it. */
export const searchQuery = z.object({
	q: z.string().trim().min(1).max(100).optional(),
});

/** Case-insensitive "contains" match of `q` against any of `columns`. LIKE wildcards in `q` are literal. */
export function searchFilter(q: string | undefined, columns: PgColumn[]): SQL | undefined {
	if (!q) return undefined;
	const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
	return or(...columns.map((column) => ilike(column, pattern)));
}

export function pageSchema<T extends z.ZodType>(item: T) {
	return z.object({
		data: z.array(item),
		page: z.number(),
		pageSize: z.number(),
		total: z.number(),
	});
}

type Paginatable = PgTable & { id: PgColumn; createdAt: PgColumn };

/**
 * One page of `table` plus the unpaged total. Newest first unless `orderBy` is given; id always breaks
 * ties last so pages never overlap.
 */
export async function paginate<T extends Paginatable>(
	db: Database,
	table: T,
	{ page, pageSize }: Pagination,
	where?: SQL,
	orderBy: SQL[] = [desc(table.createdAt)],
) {
	const [data, totals] = await Promise.all([
		db
			.select()
			.from(table as PgTable)
			.where(where)
			.orderBy(...orderBy, desc(table.id))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db
			.select({ total: count() })
			.from(table as PgTable)
			.where(where),
	]);
	return { data: data as T["$inferSelect"][], page, pageSize, total: totals[0]?.total ?? 0 };
}
