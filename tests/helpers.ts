import { exports } from "cloudflare:workers";
import { expect } from "vitest";

export const worker = exports.default;

export async function api(path: string, init: RequestInit = {}, token?: string) {
	const headers = new Headers(init.headers);
	headers.set("Content-Type", "application/json");
	if (token) headers.set("Authorization", `Bearer ${token}`);
	const res = await worker.fetch(`http://localhost${path}`, { ...init, headers });
	let body: any = null;
	try {
		body = await res.json();
	} catch {
		body = await res.text();
	}
	return { status: res.status, body };
}

export async function login(email: string, password: string) {
	const { status, body } = await api("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
	if (status !== 200) throw new Error(`login failed: ${JSON.stringify(body)}`);
	return body.access_token as string;
}

export async function uploadPdf(tenderId: string, token: string) {
	const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%%EOF");
	const form = new FormData();
	form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "proposal.pdf");
	const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
		body: form,
	});
	return { status: res.status, body: await res.json() };
}

// Product names are unique (DAT-14) and the local database persists across runs.
export function uniqueName(prefix: string) {
	return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

export const postJson = (path: string, body: unknown, token: string) =>
	api(path, { method: "POST", body: JSON.stringify(body) }, token);

export const patchJson = (path: string, body: unknown, token: string) =>
	api(path, { method: "PATCH", body: JSON.stringify(body) }, token);

export const futureDate = () => new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

// SEC-10: validation failures are 400 VALIDATION_ERROR naming the field, never FORBIDDEN.
export function expectValidationError(r: { status: number; body: any }, field: string) {
	expect(r.status).toBe(400);
	expect(r.body.error.code).toBe("VALIDATION_ERROR");
	expect(r.body.error.message).toContain(field);
}
