import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { archiveUser } from "../../domain/users/archiving";
import type { AppContext } from "../../types";

export class UserArchive extends OpenAPIRoute {
	schema = {
		tags: ["Users"],
		summary:
			"Archive a user (admin only): bans them and revokes sessions; 409 for yourself or the last admin",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "User archived",
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: z.unknown() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const user = await archiveUser(getDb(c.env), c.env, data.params.id, c.var.user.id);
		return c.json({ success: true, user });
	}
}
