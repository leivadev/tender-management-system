import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { restoreClient } from "../../domain/clients/archiving";
import type { AppContext } from "../../types";

export class ClientRestore extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "Restore an archived client (admin only)",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Client restored",
				content: { "application/json": { schema: z.object({ success: z.boolean(), client: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const client = await restoreClient(getDb(c.env), data.params.id, c.var.user.id);
		return c.json({ success: true, client });
	}
}
