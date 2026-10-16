import { fetchAllPages, fetchJson, pageQuery } from "./client";
import type { ArchivedFilter, Client, CreateClientRequest, Page, UpdateClientRequest } from "./types";

export function listClients(page: number, q?: string, archived?: ArchivedFilter) {
	return fetchJson<Page<Client>>(`/api/clients?${pageQuery(page, { q, archived })}`);
}

export function listAllClients() {
	return fetchAllPages<Client>("/api/clients");
}

export function createClient(payload: CreateClientRequest) {
	return fetchJson<{ success: true; client: Client }>("/api/clients", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function updateClient(id: string, payload: UpdateClientRequest) {
	return fetchJson<{ success: true; client: Client }>(`/api/clients/${id}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});
}

export function archiveClient(id: string) {
	return fetchJson<{ success: true; client: Client }>(`/api/clients/${id}/archive`, { method: "POST" });
}

export function restoreClient(id: string) {
	return fetchJson<{ success: true; client: Client }>(`/api/clients/${id}/restore`, { method: "POST" });
}
