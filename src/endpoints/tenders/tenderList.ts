import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenderStatusEnum, tenders } from "../../db/schema";
import type { AppContext } from "../../types";

export class TenderList extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "List tenders",
		request: {
			query: z.object({
				status: z.enum(tenderStatusEnum).optional(),
			}),
		},
		responses: {
			"200": {
				description: "Returns a list of tenders",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tenders: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const rows = data.query.status
			? await db.select().from(tenders).where(eq(tenders.status, data.query.status))
			: await db.select().from(tenders);

		return c.json({ success: true, tenders: rows });
	}
}
