import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { signInWithPassword } from "../../services/auth";
import type { AppContext } from "../../types";

const LoginInput = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export class Login extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Login with email/password",
		security: [],
		request: {
			body: { content: { "application/json": { schema: LoginInput } } },
		},
		responses: {
			"200": {
				description: "Returns the access token",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							access_token: z.string(),
							expires_at: z.number().optional(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const session = await signInWithPassword(
			c.env,
			data.body.email,
			data.body.password,
			c.req.header("CF-Connecting-IP"),
		);

		return c.json({
			success: true,
			access_token: session.access_token,
			expires_at: session.expires_at,
		});
	}
}
