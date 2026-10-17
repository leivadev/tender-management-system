import { fetchJson, pageQuery } from "./client";
import type { ArchivedFilter, CreateUserRequest, Page, UpdateUserRequest, User } from "./types";

export function listUsers(page: number, archived?: ArchivedFilter) {
	return fetchJson<Page<User>>(`/api/users?${pageQuery(page, { archived })}`);
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

export function archiveUser(id: string) {
	return fetchJson<{ success: true; user: User }>(`/api/users/${id}/archive`, { method: "POST" });
}

export function restoreUser(id: string) {
	return fetchJson<{ success: true; user: User }>(`/api/users/${id}/restore`, { method: "POST" });
}
