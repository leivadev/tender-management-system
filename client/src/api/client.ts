import { clearSession, getToken } from "../lib/auth";
import { ApiError, type ErrorCode } from "./errors";

interface ErrorBody {
	error: { code: ErrorCode; message: string };
}

let onUnauthenticated: (() => void) | null = null;

export function setUnauthenticatedHandler(handler: () => void) {
	onUnauthenticated = handler;
}

function buildHeaders(extra?: HeadersInit): Headers {
	const headers = new Headers(extra);
	const token = getToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
}

async function handleErrorResponse(res: Response): Promise<never> {
	let body: ErrorBody | null = null;
	try {
		body = await res.json();
	} catch {
		// non-JSON error body, fall through to generic error
	}

	const code = body?.error.code ?? "INTERNAL_ERROR";
	const message = body?.error.message ?? res.statusText;

	if (res.status === 401) {
		clearSession();
		onUnauthenticated?.();
	}

	throw new ApiError(code, message, res.status);
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = buildHeaders(init?.headers);
	if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const res = await fetch(path, { ...init, headers });
	if (!res.ok) return handleErrorResponse(res);
	return res.json() as Promise<T>;
}

export async function fetchBlob(path: string): Promise<Blob> {
	const res = await fetch(path, { headers: buildHeaders() });
	if (!res.ok) return handleErrorResponse(res);
	return res.blob();
}
