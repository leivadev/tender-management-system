import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { profiles } from "../../db/schema";
import type { AppContext } from "../../types";

export class UserList extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary: "List users",
		responses: {
			"200": {
				description: "Returns a list of users",
				content: { "application/json": { schema: z.object({ success: z.boolean(), users: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const db = getDb(c.env);
		const rows = await db.select().from(profiles);
		return c.json({ success: true, users: rows });
	}
}
