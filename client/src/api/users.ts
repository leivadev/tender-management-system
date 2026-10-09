import { fetchJson, pageQuery } from "./client";
import type { CreateUserRequest, Page, UpdateUserRequest, User } from "./types";

export function listUsers(page: number) {
	return fetchJson<Page<User>>(`/api/users?${pageQuery(page)}`);
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
