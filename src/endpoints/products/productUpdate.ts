import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { products } from "../../db/schema";
import { AppError, isUniqueViolation } from "../../lib/errors";
import type { AppContext } from "../../types";

const ProductUpdateInput = z
	.object({
		name: z.string().min(1).optional(),
		description: z.string().optional(),
		unitPrice: z.coerce.number().positive().optional(),
		active: z.boolean().optional(),
	})
	.refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided." });

export class ProductUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Products"],
		summary: "Update a product",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: ProductUpdateInput } } },
		},
		responses: {
			"200": {
				description: "Product updated",
				content: { "application/json": { schema: z.object({ success: z.boolean(), product: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const [product] = await db
			.update(products)
			.set({
				...(data.body.name !== undefined ? { name: data.body.name } : {}),
				...(data.body.description !== undefined ? { description: data.body.description } : {}),
				...(data.body.unitPrice !== undefined ? { unitPrice: data.body.unitPrice.toFixed(2) } : {}),
				...(data.body.active !== undefined ? { active: data.body.active } : {}),
				updatedBy: user.id,
				updatedAt: new Date(),
			})
			.where(eq(products.id, data.params.id))
			.returning()
			.catch((err) => {
				if (isUniqueViolation(err)) {
					throw new AppError("CONFLICT", `A product named "${data.body.name}" already exists.`);
				}
				throw err;
			});

		if (!product) {
			throw new AppError("NOT_FOUND", `Product ${data.params.id} not found.`);
		}

		return c.json({ success: true, product });
	}
}
