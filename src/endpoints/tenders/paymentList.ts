import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { payments } from "../../db/schema";
import type { AppContext } from "../../types";

export class PaymentList extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "List payments for a tender",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Returns the payments",
				content: { "application/json": { schema: z.object({ success: z.boolean(), payments: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const rows = await db.select().from(payments).where(eq(payments.tenderId, data.params.id));
		return c.json({ success: true, payments: rows });
	}
}
