import { count, desc, type SQL } from "drizzle-orm";
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

export function pageSchema<T extends z.ZodType>(item: T) {
	return z.object({
		data: z.array(item),
		page: z.number(),
		pageSize: z.number(),
		total: z.number(),
	});
}

type Paginatable = PgTable & { id: PgColumn; createdAt: PgColumn };

/** One page of `table`, newest first (id breaks ties so pages never overlap), plus the unpaged total. */
export async function paginate<T extends Paginatable>(
	db: Database,
	table: T,
	{ page, pageSize }: Pagination,
	where?: SQL,
) {
	const [data, totals] = await Promise.all([
		db
			.select()
			.from(table as PgTable)
			.where(where)
			.orderBy(desc(table.createdAt), desc(table.id))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db
			.select({ total: count() })
			.from(table as PgTable)
			.where(where),
	]);
	return { data: data as T["$inferSelect"][], page, pageSize, total: totals[0]?.total ?? 0 };
}
