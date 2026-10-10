import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import {
	assertValidTransition,
	type TenderStatus,
	transitionTender,
} from "../../domain/tenders/state-machine";
import { AppError } from "../../lib/errors";
import { money } from "../../lib/validation";
import type { AppContext } from "../../types";

const InvoiceInput = z.object({
	invoiceAmount: money(),
});

/**
 * This is the endpoint that drives `finalized -> for_collection`. It was
 * missing from the original API surface, which meant the transition and
 * `invoice_amount` had no way of ever being triggered.
 */
export class TenderInvoice extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Invoice a finalized tender: finalized -> for_collection",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: InvoiceInput } } },
		},
		responses: {
			"200": {
				description: "Tender invoiced",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		const [tender] = await db
			.select({ status: tenders.status })
			.from(tenders)
			.where(eq(tenders.id, tenderId));
		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
		}
		assertValidTransition(tender.status as TenderStatus, "for_collection");

		await db
			.update(tenders)
			.set({
				invoiceAmount: data.body.invoiceAmount.toFixed(2),
				updatedAt: new Date(),
				updatedBy: user.id,
			})
			.where(eq(tenders.id, tenderId));

		await transitionTender(db, tenderId, "for_collection", user.id);

		const [updated] = await db.select().from(tenders).where(eq(tenders.id, tenderId));
		return c.json({ success: true, tender: updated });
	}
}
