import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/errors";
import type { Client } from "../api/types";
import { ErrorMessage } from "../components/ErrorMessage";
import { ClientListPage } from "../routes/ClientListPage";
import { mockApi, page, renderPage } from "../test/render";

vi.mock("../lib/AuthContext", async () => {
	const { fakeAuth } = await import("../test/render");
	return { useAuth: () => fakeAuth() };
});

const pwned = () => (window as { __pwned?: boolean }).__pwned;
const HOSTILE = '<img src=x onerror="window.__pwned = true"><script>window.__pwned = true</script>';

// Every non-test source file, as raw text.
const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}"], {
	query: "?raw",
	import: "default",
	eager: true,
});

describe("server text is rendered escaped (SEC-18)", () => {
	it("SEC-18: no source file injects raw HTML", () => {
		expect(Object.keys(sources).length).toBeGreaterThan(20);
		const offenders = Object.entries(sources)
			.filter(([, text]) =>
				/dangerouslySetInnerHTML|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write/.test(text),
			)
			.map(([file]) => file);
		expect(offenders).toEqual([]);
	});

	it("SEC-18: an API error message with markup is shown as text", () => {
		const { container } = renderPage(<ErrorMessage error={new ApiError("CONFLICT", HOSTILE, 409)} />);
		expect(screen.getByRole("alert")).toHaveTextContent(HOSTILE);
		expect(container.querySelector("img, script")).toBeNull();
		expect(pwned()).toBeUndefined();
	});

	it("SEC-18: a client name with markup is shown as text in the list", async () => {
		const client: Client = {
			id: "c1",
			name: HOSTILE,
			companyName: "<b>Acme</b>",
			email: "ana@acme.test",
			archivedAt: null,
			archivedBy: null,
			createdAt: "2026-01-01T00:00:00Z",
			updatedAt: "2026-01-01T00:00:00Z",
		};
		mockApi({ "/api/clients": page([client]) });
		const { container } = renderPage(<ClientListPage />);
		await waitFor(() => expect(screen.getByText("<b>Acme</b>")).toBeInTheDocument());
		expect(screen.getByText(HOSTILE)).toBeInTheDocument();
		expect(container.querySelector("img, script, b")).toBeNull();
		expect(pwned()).toBeUndefined();
	});
});
