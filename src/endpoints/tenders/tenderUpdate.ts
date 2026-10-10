import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { withLockedTender } from "../../domain/tenders/locking";
import { assertBudgetAndDeadlineEditable, assertBudgetCoversLines } from "../../domain/tenders/rules";
import type { TenderStatus } from "../../domain/tenders/state-machine";
import { MAX_LENGTH } from "../../lib/limits";
import { futureDeadline, money, optionalText, requiredText } from "../../lib/validation";
import type { AppContext } from "../../types";

// Title and description are always editable. Budget and deadline only while the
// tender is a draft (FR-43, BR-10). clientId and status are not accepted here:
// the client is immutable (FR-13) and status only moves through
// `transitionTender()` (state-machine.ts).
const TenderUpdateInput = z
	.object({
		title: requiredText(MAX_LENGTH.tenderTitle).optional(),
		description: optionalText(MAX_LENGTH.tenderDescription).optional(),
		maxBudget: money().optional(),
		deadline: futureDeadline().optional(),
	})
	.refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided." });

export class TenderUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Update a tender (title, description; budget and deadline only while draft)",
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

		const { maxBudget, deadline, ...rest } = data.body;
		const changesBudgetOrDeadline = maxBudget !== undefined || deadline !== undefined;

		const tender = await withLockedTender(db, data.params.id, async (tx, current) => {
			if (changesBudgetOrDeadline) {
				assertBudgetAndDeadlineEditable(current.status as TenderStatus);
			}
			if (maxBudget !== undefined) {
				await assertBudgetCoversLines(tx, current.id, maxBudget);
			}

			const [updated] = await tx
				.update(tenders)
				.set({
					...rest,
					...(maxBudget !== undefined && { maxBudget: maxBudget.toFixed(2) }),
					...(deadline !== undefined && { deadline: new Date(deadline) }),
					updatedBy: user.id,
					updatedAt: new Date(),
				})
				.where(eq(tenders.id, current.id))
				.returning();
			return updated;
		});

		return c.json({ success: true, tender });
	}
}
