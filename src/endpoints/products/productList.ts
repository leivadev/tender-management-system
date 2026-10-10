import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { products } from "../../db/schema";
import { pageSchema, paginate, paginationQuery, searchFilter, searchQuery } from "../../lib/pagination";
import type { AppContext } from "../../types";

export class ProductList extends OpenAPIRoute {
	schema = {
		tags: ["Products"],
		summary: "List products (optional `q` matches name or description)",
		request: { query: paginationQuery.extend(searchQuery.shape) },
		responses: {
			"200": {
				description: "Returns a page of products, newest first",
				content: { "application/json": { schema: pageSchema(z.any()) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const where = searchFilter(data.query.q, [products.name, products.description]);
		return c.json(await paginate(db, products, data.query, where));
	}
}
