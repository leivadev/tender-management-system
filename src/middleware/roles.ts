import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/errors";
import type { AppBindings, AuthedUser } from "./auth";

export function requireRole(role: AuthedUser["role"]): MiddlewareHandler<AppBindings> {
	return async (c, next) => {
		const user = c.var.user;
		if (!user || user.role !== role) {
			throw new AppError("FORBIDDEN", `This action requires the ${role} role.`);
		}
		await next();
	};
}
