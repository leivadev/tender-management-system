import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { profiles } from "../../db/schema";
import { archivedQuery, archiveFilter } from "../../lib/archive";
import { pageSchema, paginate, paginationQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

export class UserList extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary: "List users (admin only; `archived=only|include`)",
		request: { query: paginationQuery.extend(archivedQuery.shape) },
		responses: {
			"200": {
				description: "Returns a page of users, newest first",
				content: { "application/json": { schema: pageSchema(z.any()) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const where = archiveFilter(profiles.archivedAt, data.query.archived, c.var.user.role);
		return c.json(await paginate(db, profiles, data.query, where));
	}
}
