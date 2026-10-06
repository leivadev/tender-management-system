import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenderStatusHistory } from "../../db/schema";
import type { AppContext } from "../../types";

export class TenderHistory extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Status transition history for a tender",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Returns the status history",
				content: { "application/json": { schema: z.object({ success: z.boolean(), history: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const rows = await db
			.select()
			.from(tenderStatusHistory)
			.where(eq(tenderStatusHistory.tenderId, data.params.id));

		return c.json({ success: true, history: rows });
	}
}
