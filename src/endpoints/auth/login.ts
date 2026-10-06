import { createClient } from "@supabase/supabase-js";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppError } from "../../lib/errors";
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
		const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_PUBLISHABLE_KEY);

		const { data: authData, error } = await supabase.auth.signInWithPassword({
			email: data.body.email,
			password: data.body.password,
		});

		if (error || !authData.session) {
			throw new AppError("UNAUTHENTICATED", "Invalid email or password.");
		}

		return c.json({
			success: true,
			access_token: authData.session.access_token,
			expires_at: authData.session.expires_at,
		});
	}
}
