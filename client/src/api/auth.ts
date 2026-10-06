import { fetchJson } from "./client";
import type { LoginRequest, LoginResponse, User } from "./types";

export function login(payload: LoginRequest) {
	return fetchJson<LoginResponse>("/api/auth/login", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function logout() {
	return fetchJson<{ success: true }>("/api/auth/logout", { method: "POST" });
}

export function me() {
	return fetchJson<{ success: true; user: User }>("/api/auth/me");
}
