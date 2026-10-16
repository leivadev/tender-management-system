import { OpenAPIRoute } from "chanfana";
import { and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients } from "../../db/schema";
import { archivedQuery, archiveFilter } from "../../lib/archive";
import { pageSchema, paginate, paginationQuery, searchFilter, searchQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

export class ClientList extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "List clients (optional `q` matches name, company or email; admin-only `archived=only|include`)",
		request: { query: paginationQuery.extend(searchQuery.shape).extend(archivedQuery.shape) },
		responses: {
			"200": {
				description: "Returns a page of clients, newest first",
				content: { "application/json": { schema: pageSchema(z.any()) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const where = and(
			searchFilter(data.query.q, [clients.name, clients.companyName, clients.email]),
			archiveFilter(clients.archivedAt, data.query.archived, c.var.user.role),
		);
		return c.json(await paginate(db, clients, data.query, where));
	}
}
