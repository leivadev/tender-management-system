import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getSupabaseAdminClient } from "../../services/auth";
import type { AppContext } from "../../types";

export class Logout extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Logout (revokes refresh tokens for the current session)",
		responses: {
			"200": {
				description: "Logged out",
				content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const authHeader = c.req.header("Authorization") ?? "";
		const jwt = authHeader.replace(/^Bearer\s+/i, "");

		const admin = getSupabaseAdminClient(c.env);
		await admin.auth.admin.signOut(jwt);

		return c.json({ success: true });
	}
}
