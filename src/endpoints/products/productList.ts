import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { products } from "../../db/schema";
import type { AppContext } from "../../types";

export class ProductList extends OpenAPIRoute {
	schema = {
		tags: ["Products"],
		summary: "List products",
		responses: {
			"200": {
				description: "Returns a list of products",
				content: { "application/json": { schema: z.object({ success: z.boolean(), products: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const db = getDb(c.env);
		const rows = await db.select().from(products);
		return c.json({ success: true, products: rows });
	}
}
