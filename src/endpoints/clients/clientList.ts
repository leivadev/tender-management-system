import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients } from "../../db/schema";
import { pageSchema, paginate, paginationQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

export class ClientList extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "List clients",
		request: { query: paginationQuery },
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
		return c.json(await paginate(db, clients, data.query));
	}
}
