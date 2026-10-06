import { OpenAPIRoute } from "chanfana";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenderProducts, tenders } from "../../db/schema";
import { assertProductsEditable, type TenderStatus } from "../../domain/tenders/state-machine";
import { AppError } from "../../lib/errors";
import type { AppContext } from "../../types";

export class TenderRemoveProduct extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Remove a product from a tender",
		request: {
			params: z.object({ id: z.uuid(), productId: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Product removed",
				content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const tenderId = data.params.id;

		const [tender] = await db.select().from(tenders).where(eq(tenders.id, tenderId));
		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
		}
		assertProductsEditable(tender.status as TenderStatus);

		await db
			.delete(tenderProducts)
			.where(and(eq(tenderProducts.tenderId, tenderId), eq(tenderProducts.productId, data.params.productId)));

		return c.json({ success: true });
	}
}
