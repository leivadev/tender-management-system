import { fetchJson } from "./client";
import type { Client, CreateClientRequest, UpdateClientRequest } from "./types";

export function listClients() {
	return fetchJson<{ success: true; clients: Client[] }>("/api/clients");
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
