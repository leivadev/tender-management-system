import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { MAX_LENGTH } from "../../lib/limits";
import { emailAddress, requiredText } from "../../lib/validation";
import type { AppContext } from "../../types";

const ClientUpdateInput = z
	.object({
		name: requiredText(MAX_LENGTH.contactName).optional(),
		companyName: requiredText(MAX_LENGTH.companyName).optional(),
		email: emailAddress().optional(),
	})
	.refine((body) => Object.keys(body).length > 0, { message: "At least one field must be provided." });

export class ClientUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Clients"],
		summary: "Update a client",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: ClientUpdateInput } } },
		},
		responses: {
			"200": {
				description: "Client updated",
				content: { "application/json": { schema: z.object({ success: z.boolean(), client: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const [client] = await db
			.update(clients)
			.set({ ...data.body, updatedBy: user.id, updatedAt: new Date() })
			.where(eq(clients.id, data.params.id))
			.returning();

		if (!client) {
			throw new AppError("NOT_FOUND", `Client ${data.params.id} not found.`);
		}

		return c.json({ success: true, client });
	}
}
