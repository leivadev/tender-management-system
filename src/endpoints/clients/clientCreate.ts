import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients } from "../../db/schema";
import type { AppContext } from "../../types";

const ClientInput = z.object({
	name: z.string().min(1),
	companyName: z.string().min(1),
	email: z.email(),
});

export class ClientCreate extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "Create a client",
		request: {
			body: { content: { "application/json": { schema: ClientInput } } },
		},
		responses: {
			"201": {
				description: "Client created",
				content: { "application/json": { schema: z.object({ success: z.boolean(), client: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const [client] = await db
			.insert(clients)
			.values({ ...data.body, createdBy: user.id, updatedBy: user.id })
			.returning();

		return c.json({ success: true, client }, 201);
	}
}
