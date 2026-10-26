import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type Database, getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { assertClientSelectable } from "../../domain/clients/archiving";
import { MAX_LENGTH } from "../../lib/limits";
import { futureDeadline, money, optionalText, requiredText } from "../../lib/validation";
import type { AppContext } from "../../types";

const TenderInput = z.object({
	clientId: z.uuid(),
	title: requiredText(MAX_LENGTH.tenderTitle),
	description: optionalText(MAX_LENGTH.tenderDescription).optional(),
	maxBudget: money(),
	deadline: futureDeadline(),
});

export class TenderCreate extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Create a tender (starts in draft)",
		request: {
			body: { content: { "application/json": { schema: TenderInput } } },
		},
		responses: {
			"201": {
				description: "Tender created",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.unknown() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const tender = await db.transaction(async (tx) => {
			const database = tx as unknown as Database;
			await assertClientSelectable(database, data.body.clientId);
			const [created] = await database
				.insert(tenders)
				.values({
					clientId: data.body.clientId,
					title: data.body.title,
					description: data.body.description,
					maxBudget: data.body.maxBudget.toFixed(2),
					deadline: new Date(data.body.deadline),
					status: "draft",
					createdBy: user.id,
					updatedBy: user.id,
				})
				.returning();
			return created;
		});

		return c.json({ success: true, tender }, 201);
	}
}
