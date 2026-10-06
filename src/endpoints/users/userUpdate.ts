import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { profiles, roleEnum } from "../../db/schema";
import { AppError } from "../../lib/errors";
import type { AppContext } from "../../types";

const UserUpdateInput = z.object({
	role: z.enum(roleEnum),
});

export class UserUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary: "Update a user's role (admin only)",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: UserUpdateInput } } },
		},
		responses: {
			"200": {
				description: "User updated",
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const [profile] = await db
			.update(profiles)
			.set({ role: data.body.role, updatedAt: new Date() })
			.where(eq(profiles.id, data.params.id))
			.returning();

		if (!profile) {
			throw new AppError("NOT_FOUND", `User ${data.params.id} not found.`);
		}

		return c.json({ success: true, user: profile });
	}
}
