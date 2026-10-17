import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { restoreTender } from "../../domain/tenders/archiving";
import type { AppContext } from "../../types";

export class TenderRestore extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Restore an archived tender (admin only); works even if its client is archived",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Tender restored",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const tender = await restoreTender(getDb(c.env), data.params.id, c.var.user.id);
		return c.json({ success: true, tender });
	}
}
