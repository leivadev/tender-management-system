import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client, Product, TenderListItem, User } from "../api/types";
import { mockApi, page, renderPage, setRole } from "../test/render";
import { ClientListPage } from "./ClientListPage";
import { ForbiddenPage } from "./ForbiddenPage";
import { NotFoundPage } from "./NotFoundPage";
import { ProductListPage } from "./ProductListPage";
import { TenderListPage } from "./TenderListPage";
import { UserListPage } from "./UserListPage";

vi.mock("../lib/AuthContext", async () => {
	const { fakeAuth } = await import("../test/render");
	return { useAuth: () => fakeAuth() };
});

const client: Client = {
	id: "c1",
	name: "Ana Pérez",
	companyName: "Acme",
	email: "ana@acme.test",
	archivedAt: null,
	archivedBy: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};
const product: Product = {
	id: "p1",
	name: "Widget",
	description: null,
	unitPrice: "10.00",
	active: true,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};
const user: User = {
	id: "u2",
	email: "writer@example.com",
	role: "user",
	archivedAt: null,
	archivedBy: null,
};
const tender = {
	id: "t1",
	clientId: "c1",
	clientName: "Acme",
	title: "Road repair",
	description: null,
	maxBudget: "1000.00",
	deadline: "2027-03-01T00:00:00Z",
	status: "active",
	archivedAt: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
} as TenderListItem;

beforeEach(() => {
	setRole("admin");
	mockApi({
		"/api/clients": page([client]),
		"/api/products": page([product]),
		"/api/users": page([user]),
		"/api/tenders": page([tender]),
	});
});

describe("every page has one top-level heading (UI-07)", () => {
	it.each([
		["tenders", <TenderListPage key="t" />, "Tenders"],
		["clients", <ClientListPage key="c" />, "Clients"],
		["products", <ProductListPage key="p" />, "Products"],
		["users", <UserListPage key="u" />, "Users"],
		["access denied", <ForbiddenPage key="f" />, "Access denied"],
		["not found", <NotFoundPage key="n" />, "Page not found"],
	])("%s", async (_name, ui, title) => {
		renderPage(ui);
		const headings = await screen.findAllByRole("heading", { level: 1 });
		expect(headings).toHaveLength(1);
		expect(headings[0]).toHaveTextContent(title);
	});
});

describe("Edit is neutral, red is for destructive actions (UI-06)", () => {
	it("clients, products and users use the same quiet Edit button as Archive", async () => {
		for (const [ui, findRow] of [
			[<ClientListPage key="c" />, "Acme"],
			[<ProductListPage key="p" />, "Widget"],
			[<UserListPage key="u" />, "writer@example.com"],
		] as const) {
			const { unmount } = renderPage(ui);
			const row = (await screen.findByText(findRow)).closest("tr") as HTMLElement;
			const edit = within(row).getByRole("button", { name: "Edit" });
			expect(edit.className).not.toMatch(/destructive|negative/);
			unmount();
		}
	});
});

describe("inline edits are labelled and submit with Enter (UI-08)", () => {
	it("client row: labelled fields, Enter saves, Escape cancels", async () => {
		const calls = mockApi({
			"/api/clients/c1": () => ({ success: true, client }),
			"/api/clients": page([client]),
		});
		renderPage(<ClientListPage />);
		await userEvent.click(await screen.findByRole("button", { name: "Edit" }));

		const name = screen.getByLabelText("Name");
		expect(screen.getByLabelText("Company")).toBeInTheDocument();
		expect(screen.getByLabelText("Email")).toBeInTheDocument();

		await userEvent.clear(name);
		await userEvent.type(name, "Ana Gómez{Enter}");
		await waitFor(() =>
			expect(calls).toContainEqual(
				expect.objectContaining({
					method: "PATCH",
					url: "/api/clients/c1",
					body: expect.objectContaining({ name: "Ana Gómez" }),
				}),
			),
		);
	});

	it("client row: Escape leaves edit mode without saving", async () => {
		const calls = mockApi({ "/api/clients": page([client]) });
		renderPage(<ClientListPage />);
		await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
		await userEvent.type(screen.getByLabelText("Name"), "x{Escape}");
		expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
		expect(calls.some((c) => c.method === "PATCH")).toBe(false);
	});

	it("product row: Enter saves", async () => {
		const calls = mockApi({
			"/api/products/p1": () => ({ success: true, product }),
			"/api/products": page([product]),
		});
		renderPage(<ProductListPage />);
		await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
		await userEvent.type(screen.getByLabelText("Description"), "Blue{Enter}");
		await waitFor(() =>
			expect(calls).toContainEqual(expect.objectContaining({ method: "PATCH", url: "/api/products/p1" })),
		);
	});

	it("user row: Enter on the role select saves", async () => {
		const calls = mockApi({
			"/api/users/u2": () => ({ success: true, user }),
			"/api/users": page([user]),
		});
		renderPage(<UserListPage />);
		const row = (await screen.findByText("writer@example.com")).closest("tr") as HTMLElement;
		await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
		await userEvent.selectOptions(screen.getByLabelText("Role"), "viewer");
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(calls).toContainEqual(
				expect.objectContaining({ method: "PATCH", url: "/api/users/u2", body: { role: "viewer" } }),
			),
		);
	});
});

describe("tender list columns at 360 px (UI-04)", () => {
	it("status, due date and client fold into the title cell below the md breakpoint", async () => {
		renderPage(<TenderListPage />);
		const row = (await screen.findByText("Road repair")).closest("tr") as HTMLElement;
		const titleCell = within(row).getAllByRole("cell")[0] as HTMLElement;
		const summary = within(titleCell).getByTestId("tender-mobile-summary");
		expect(summary.className).toContain("md:hidden");
		expect(summary).toHaveTextContent("Active");
		expect(summary).toHaveTextContent(/Due/);
		expect(summary).toHaveTextContent("Acme");
		expect(summary).toHaveTextContent(/Created/);
	});

	it("sorting stays available below md through a select", async () => {
		const calls = mockApi({ "/api/tenders": page([tender]) });
		renderPage(<TenderListPage />);
		const select = await screen.findByLabelText("Sort by");
		expect(select.className).toContain("md:hidden");

		await userEvent.selectOptions(select, "deadline:asc");
		await waitFor(() =>
			expect(calls.some((c) => c.url.includes("sort=deadline") && c.url.includes("dir=asc"))).toBe(true),
		);
	});

	it("the full columns stay on wider screens", async () => {
		renderPage(<TenderListPage />);
		await screen.findByText("Road repair");
		for (const name of ["Client", "Due", "Status", "Created"]) {
			const header = screen.getByRole("columnheader", { name: new RegExp(name) });
			expect(header.className).toContain("md:table-cell");
			expect(header.className).toContain("hidden");
		}
	});
});
