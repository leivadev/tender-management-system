import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { reloadTender, withLockedTender } from "../../domain/tenders/locking";
import { transitionTender } from "../../domain/tenders/state-machine";
import type { AppContext } from "../../types";

export class TenderLost extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Manually mark tender as lost: active -> lost",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Tender marked as lost",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		const updated = await withLockedTender(db, tenderId, async (tx) => {
			await transitionTender(tx, tenderId, "lost", user.id);
			return reloadTender(tx, tenderId);
		});

		return c.json({ success: true, tender: updated });
	}
}
