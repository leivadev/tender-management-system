import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { roleEnum } from "../../db/schema";
import { changeUserRole } from "../../domain/users/archiving";
import type { AppContext } from "../../types";

const UserUpdateInput = z.strictObject({
	role: z.enum(roleEnum),
});

export class UserUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary: "Update a user's role (admin only); 409 for your own role or the last admin",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: UserUpdateInput } } },
		},
		responses: {
			"200": {
				description: "User updated",
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: z.unknown() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const user = await changeUserRole(getDb(c.env), data.params.id, data.body.role, c.var.user.id);
		return c.json({ success: true, user });
	}
}
