import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { products } from "../../db/schema";
import type { AppContext } from "../../types";

const ProductInput = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	unitPrice: z.coerce.number().positive(),
});

export class ProductCreate extends OpenAPIRoute {
	schema = {
		tags: ["Products"],
		summary: "Create a product",
		request: {
			body: { content: { "application/json": { schema: ProductInput } } },
		},
		responses: {
			"201": {
				description: "Product created",
				content: { "application/json": { schema: z.object({ success: z.boolean(), product: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const [product] = await db
			.insert(products)
			.values({
				name: data.body.name,
				description: data.body.description,
				unitPrice: data.body.unitPrice.toFixed(2),
				createdBy: user.id,
				updatedBy: user.id,
			})
			.returning();

		return c.json({ success: true, product }, 201);
	}
}
