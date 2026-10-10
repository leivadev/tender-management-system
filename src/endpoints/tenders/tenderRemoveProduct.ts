import { OpenAPIRoute } from "chanfana";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenderProducts } from "../../db/schema";
import { withLockedTender } from "../../domain/tenders/locking";
import { assertProductsEditable, type TenderStatus } from "../../domain/tenders/state-machine";
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

		await withLockedTender(db, tenderId, async (tx, tender) => {
			assertProductsEditable(tender.status as TenderStatus);

			await tx
				.delete(tenderProducts)
				.where(
					and(eq(tenderProducts.tenderId, tenderId), eq(tenderProducts.productId, data.params.productId)),
				);
		});

		return c.json({ success: true });
	}
}
