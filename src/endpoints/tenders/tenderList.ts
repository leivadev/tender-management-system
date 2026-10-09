import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenderStatusEnum, tenders } from "../../db/schema";
import { pageSchema, paginate, paginationQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

export class TenderList extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "List tenders",
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
		return c.json(await paginate(db, tenders, data.query, where));
	}
}
