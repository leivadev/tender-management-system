import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { profiles, roleEnum } from "../../db/schema";
import { createAuthUser } from "../../services/auth";
import type { AppContext } from "../../types";

const UserInput = z.object({
	email: z.email(),
	password: z.string().min(8),
	role: z.enum(roleEnum).default("user"),
});

export class UserCreate extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary: "Create a user (admin only)",
		request: {
			body: { content: { "application/json": { schema: UserInput } } },
		},
		responses: {
			"201": {
				description: "User created",
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: z.any() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const actor = c.var.user;

		const authUser = await createAuthUser(c.env, data.body.email, data.body.password);

		const [profile] = await db
			.insert(profiles)
			.values({
				id: authUser.id,
				email: data.body.email,
				role: data.body.role,
				createdBy: actor.id,
			})
			.returning();

		return c.json({ success: true, user: profile }, 201);
	}
}
