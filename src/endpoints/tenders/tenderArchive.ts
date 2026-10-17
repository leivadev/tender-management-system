import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { archiveTender } from "../../domain/tenders/archiving";
import type { AppContext } from "../../types";

export class TenderArchive extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Archive a tender (admin only); only draft, collected or lost",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Tender archived",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const tender = await archiveTender(getDb(c.env), data.params.id, c.var.user.id);
		return c.json({ success: true, tender });
	}
}
