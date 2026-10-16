import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { archiveClient } from "../../domain/clients/archiving";
import type { AppContext } from "../../types";

export class ClientArchive extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "Archive a client (admin only); 409 while it has open tenders",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Client archived",
				content: { "application/json": { schema: z.object({ success: z.boolean(), client: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const client = await archiveClient(getDb(c.env), data.params.id, c.var.user.id);
		return c.json({ success: true, client });
	}
}
