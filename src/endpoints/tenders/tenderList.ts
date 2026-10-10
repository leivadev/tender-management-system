import { OpenAPIRoute } from "chanfana";
import { and, asc, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients, tenderStatusEnum, tenders } from "../../db/schema";
import { pageSchema, paginate, paginationQuery, searchFilter, searchQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

const SORT_COLUMNS = {
	created: tenders.createdAt,
	deadline: tenders.deadline,
	budget: tenders.maxBudget,
	title: tenders.title,
} as const;

export class TenderList extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "List tenders (with client name); `q` matches title or client, `sort`/`dir` reorder",
		request: {
			query: paginationQuery.extend(searchQuery.shape).extend({
				status: z.enum(tenderStatusEnum).optional(),
				sort: z.enum(["created", "deadline", "budget", "title"]).default("created"),
				dir: z.enum(["asc", "desc"]).default("desc"),
			}),
		},
		responses: {
			"200": {
				description: "Returns a page of tenders, newest first unless `sort`/`dir` say otherwise",
				content: { "application/json": { schema: pageSchema(z.any()) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const { status, q, sort, dir } = data.query;
		const clientMatch = searchFilter(q, [clients.name, clients.companyName]);
		const search: SQL | undefined = q
			? or(
					searchFilter(q, [tenders.title]),
					inArray(tenders.clientId, db.select({ id: clients.id }).from(clients).where(clientMatch)),
				)
			: undefined;
		const where = and(status ? eq(tenders.status, status) : undefined, search);
		const page = await paginate(db, tenders, data.query, where, [
			(dir === "asc" ? asc : desc)(SORT_COLUMNS[sort]),
		]);

		// Attach the client name for just this page, so the SPA needs no separate client lookup.
		const clientIds = [...new Set(page.data.map((t) => t.clientId))];
		const names = clientIds.length
			? await db
					.select({ id: clients.id, name: clients.name })
					.from(clients)
					.where(inArray(clients.id, clientIds))
			: [];
		const nameById = new Map(names.map((n) => [n.id, n.name]));

		return c.json({
			...page,
			data: page.data.map((t) => ({ ...t, clientName: nameById.get(t.clientId) ?? null })),
		});
	}
}
