import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { products, tenderProducts, tenders } from "../../db/schema";
import { assertWithinBudget } from "../../domain/tenders/rules";
import { assertProductsEditable, type TenderStatus } from "../../domain/tenders/state-machine";
import { AppError } from "../../lib/errors";
import type { AppContext } from "../../types";

const AddProductInput = z.object({
	productId: z.uuid(),
	quantity: z.coerce.number().positive(),
});

export class TenderAddProduct extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Add a product to a tender",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: AddProductInput } } },
		},
		responses: {
			"201": {
				description: "Product added",
				content: {
					"application/json": { schema: z.object({ success: z.boolean(), tenderProduct: z.any() }) },
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		return db.transaction(async (tx) => {
			const [tender] = await tx.select().from(tenders).where(eq(tenders.id, tenderId));
			if (!tender) {
				throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
			}
			assertProductsEditable(tender.status as TenderStatus);

			const [product] = await tx.select().from(products).where(eq(products.id, data.body.productId));
			if (!product) {
				throw new AppError("NOT_FOUND", `Product ${data.body.productId} not found.`);
			}

			const unitPrice = Number(product.unitPrice);
			const subtotal = unitPrice * data.body.quantity;

			await assertWithinBudget(tx as unknown as typeof db, tenderId, Number(tender.maxBudget), subtotal);

			const [tenderProduct] = await tx
				.insert(tenderProducts)
				.values({
					tenderId,
					productId: product.id,
					quantity: data.body.quantity.toFixed(2),
					unitPrice: unitPrice.toFixed(2),
					subtotal: subtotal.toFixed(2),
					createdBy: user.id,
					updatedBy: user.id,
				})
				.returning();

			return c.json({ success: true, tenderProduct }, 201);
		});
	}
}
