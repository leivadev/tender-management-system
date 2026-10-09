import { exports } from "cloudflare:workers";

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
