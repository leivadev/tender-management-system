import { endSession, getToken } from "../lib/auth";
import { ApiError, type ErrorCode, type FieldIssue } from "./errors";
import type { Page } from "./types";

interface ErrorBody {
	error?: { code: ErrorCode; message: string; fields?: FieldIssue[] };
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

async function handleErrorResponse(res: Response, hadToken: boolean): Promise<never> {
	let body: ErrorBody | null = null;
	try {
		body = await res.json();
	} catch {
		// non-JSON error body, fall through to generic error
	}

	const code = body?.error?.code ?? "INTERNAL_ERROR";
	// Replies without a server message (proxy pages, network layers) fall back to the generic text.
	const message = body?.error?.message ?? "";

	// UI-10: a 401 on an authenticated request means the session is gone. The login call itself
	// (no token yet) also answers 401 for bad credentials, which is not a session ending.
	if (res.status === 401 && hadToken) {
		endSession();
		onUnauthenticated?.();
	}

	throw new ApiError(code, message, res.status, body?.error?.fields);
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = buildHeaders(init?.headers);
	if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const res = await fetch(path, { ...init, headers });
	if (!res.ok) return handleErrorResponse(res, headers.has("Authorization"));
	return res.json() as Promise<T>;
}

export const MAX_PAGE_SIZE = 100;

export function pageQuery(page: number, extra: Record<string, string | undefined> = {}) {
	const params = new URLSearchParams({ page: String(page) });
	for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
	return params.toString();
}

/** Walks every page of a list endpoint, for dropdowns and lookups that need the full set. */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
	const items: T[] = [];
	for (let page = 1; ; page++) {
		const res = await fetchJson<Page<T>>(`${path}?${pageQuery(page)}&pageSize=${MAX_PAGE_SIZE}`);
		items.push(...res.data);
		if (page * MAX_PAGE_SIZE >= res.total) return items;
	}
}

export async function fetchBlob(path: string): Promise<Blob> {
	const headers = buildHeaders();
	const res = await fetch(path, { headers });
	if (!res.ok) return handleErrorResponse(res, headers.has("Authorization"));
	return res.blob();
}
