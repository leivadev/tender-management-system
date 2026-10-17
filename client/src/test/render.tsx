import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { TooltipProvider } from "../components/Tooltip";
import type { Role } from "../lib/auth";

let currentRole: Role = "admin";

/** `vi.mock("../lib/AuthContext", ...)` in a test file points useAuth at this. */
export function fakeAuth() {
	return {
		isAuthenticated: true,
		sessionEnded: false,
		isLoading: false,
		isAdmin: currentRole === "admin",
		role: currentRole,
		canWrite: currentRole !== "viewer",
		userId: "u1",
		email: "admin@example.com",
		login: vi.fn(),
		logout: vi.fn(),
	};
}

export function setRole(role: Role) {
	currentRole = role;
}

type Handler = (url: string, init?: RequestInit) => unknown;

/** Replaces global fetch; `routes` maps a URL prefix to a JSON body (or a function returning one). */
export function mockApi(routes: Record<string, unknown | Handler>) {
	const calls: { url: string; method: string; body?: unknown }[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			calls.push({
				url,
				method: init?.method ?? "GET",
				body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
			});
			const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
			const value = key ? routes[key] : { data: [], page: 1, pageSize: 20, total: 0 };
			const body = typeof value === "function" ? (value as Handler)(url, init) : value;
			return new Response(JSON.stringify(body), { status: 200 });
		}),
	);
	return calls;
}

export function page<T>(data: T[]) {
	return { data, page: 1, pageSize: 20, total: data.length };
}

export function renderPage(ui: ReactElement, path = "/") {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
			</TooltipProvider>
		</QueryClientProvider>,
	);
}
