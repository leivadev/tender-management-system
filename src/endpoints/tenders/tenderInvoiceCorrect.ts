import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { reloadTender, withLockedTender } from "../../domain/tenders/locking";
import { assertInvoiceCorrectable } from "../../domain/tenders/rules";
import { money } from "../../lib/validation";
import type { AppContext } from "../../types";

// BR-16: any amount above zero; not capped by the budget or the lines (only by DAT-13 money bounds).
const CorrectInvoiceInput = z.object({
	invoiceAmount: money(),
});

/**
 * FR-50: an admin fixes a wrong invoiced amount while the tender is still
 * `for_collection` and has no payments. The status is untouched, so this
 * deliberately bypasses `transitionTender()` and leaves no history row; the
 * change is attributed through `updated_by` / `updated_at` (DAT-06).
 */
export class TenderInvoiceCorrect extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Correct the invoiced amount of a for_collection tender with no payments",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: CorrectInvoiceInput } } },
		},
		responses: {
			"200": {
				description: "Invoiced amount corrected",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		const updated = await withLockedTender(db, tenderId, async (tx, tender) => {
			await assertInvoiceCorrectable(tx, tender);

			await tx
				.update(tenders)
				.set({
					invoiceAmount: data.body.invoiceAmount.toFixed(2),
					updatedAt: new Date(),
					updatedBy: user.id,
				})
				.where(eq(tenders.id, tenderId));

			return reloadTender(tx, tenderId);
		});

		return c.json({ success: true, tender: updated });
	}
}
