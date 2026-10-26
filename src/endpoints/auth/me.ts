import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";

export class Me extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Current authenticated user",
		responses: {
			"200": {
				description: "Returns the current user",
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: z.unknown() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		return c.json({ success: true, user: c.var.user });
	}
}
