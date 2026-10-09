import { fetchAllPages, fetchJson, pageQuery } from "./client";
import type { Client, CreateClientRequest, Page, UpdateClientRequest } from "./types";

export function listClients(page: number) {
	return fetchJson<Page<Client>>(`/api/clients?${pageQuery(page)}`);
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
