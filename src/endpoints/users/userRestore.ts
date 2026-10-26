import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { restoreUser } from "../../domain/users/archiving";
import type { AppContext } from "../../types";

export class UserRestore extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary: "Restore an archived user (admin only): lifts the ban, keeps their role",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "User restored",
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: z.unknown() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const user = await restoreUser(getDb(c.env), c.env, data.params.id, c.var.user.id);
		return c.json({ success: true, user });
	}
}
