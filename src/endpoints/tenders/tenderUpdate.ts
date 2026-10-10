import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { MAX_LENGTH } from "../../lib/limits";
import { optionalText, requiredText } from "../../lib/validation";
import type { AppContext } from "../../types";

// Intentionally limited to informational fields only (title, description).
// maxBudget/deadline/clientId are not editable here: they interact with
// budget validation, cron expiry and the state machine — see rules.ts and
// state-machine.ts. This endpoint never touches tenders.status.
const TenderUpdateInput = z
	.object({
		title: requiredText(MAX_LENGTH.tenderTitle).optional(),
		description: optionalText(MAX_LENGTH.tenderDescription).optional(),
	})
	.refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided." });

export class TenderUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Update a tender's informational fields (title, description)",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: TenderUpdateInput } } },
		},
		responses: {
			"200": {
				description: "Tender updated",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const [tender] = await db
			.update(tenders)
			.set({ ...data.body, updatedBy: user.id, updatedAt: new Date() })
			.where(eq(tenders.id, data.params.id))
			.returning();

		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${data.params.id} not found.`);
		}

		return c.json({ success: true, tender });
	}
}
