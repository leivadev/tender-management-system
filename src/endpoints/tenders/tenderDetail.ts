import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients, products, tenderProducts, tenderStatusHistory, tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";
import type { AppContext } from "../../types";

export class TenderDetail extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Tender detail: general data, products and status history",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Returns the tender detail",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.unknown() }) } },
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

		const items = await db
			.select({
				id: tenderProducts.id,
				productId: tenderProducts.productId,
				productName: products.name,
				quantity: tenderProducts.quantity,
				unitPrice: tenderProducts.unitPrice,
				subtotal: tenderProducts.subtotal,
			})
			.from(tenderProducts)
			.innerJoin(products, eq(tenderProducts.productId, products.id))
			.where(eq(tenderProducts.tenderId, tenderId));

		const history = await db
			.select()
			.from(tenderStatusHistory)
			.where(eq(tenderStatusHistory.tenderId, tenderId));

		// Looked up by id, not through the client list: archived clients stay named on their tenders (FR-42).
		const [client] = await db
			.select({ name: clients.name })
			.from(clients)
			.where(eq(clients.id, tender.clientId));

		return c.json({
			success: true,
			tender: { ...tender, clientName: client?.name ?? null, products: items, history },
		});
	}
}
