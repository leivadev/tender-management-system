import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients } from "../../db/schema";
import type { AppContext } from "../../types";

export class ClientList extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "List clients",
		responses: {
			"200": {
				description: "Returns a list of clients",
				content: { "application/json": { schema: z.object({ success: z.boolean(), clients: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const db = getDb(c.env);
		const rows = await db.select().from(clients);
		return c.json({ success: true, clients: rows });
	}
}
