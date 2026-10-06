import { fetchJson } from "./client";
import type { CreateUserRequest, UpdateUserRequest, User } from "./types";

export function listUsers() {
	return fetchJson<{ success: true; users: User[] }>("/api/users");
}

export function createUser(payload: CreateUserRequest) {
	return fetchJson<{ success: true; user: User }>("/api/users", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function updateUser(id: string, payload: UpdateUserRequest) {
	return fetchJson<{ success: true; user: User }>(`/api/users/${id}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});
}
