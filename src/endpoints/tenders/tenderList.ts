import { OpenAPIRoute } from "chanfana";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients, tenderStatusEnum, tenders } from "../../db/schema";
import { pageSchema, paginate, paginationQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

export class TenderList extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "List tenders (with client name)",
		request: {
			query: paginationQuery.extend({
				status: z.enum(tenderStatusEnum).optional(),
			}),
		},
		responses: {
			"200": {
				description: "Returns a page of tenders, newest first",
				content: { "application/json": { schema: pageSchema(z.any()) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const where = data.query.status ? eq(tenders.status, data.query.status) : undefined;
		const page = await paginate(db, tenders, data.query, where);

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
