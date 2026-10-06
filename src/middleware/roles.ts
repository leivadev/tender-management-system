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

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function blockViewerWrites(): MiddlewareHandler<AppBindings> {
	return async (c, next) => {
		if (
			c.var.user?.role === "viewer" &&
			!READ_ONLY_METHODS.has(c.req.method) &&
			c.req.path !== "/api/auth/logout"
		) {
			throw new AppError("FORBIDDEN", "Viewers have read-only access.");
		}
		await next();
	};
}
