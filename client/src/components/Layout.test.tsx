import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderPage } from "../test/render";
import { Layout } from "./Layout";

vi.mock("../lib/AuthContext", async () => {
	const { fakeAuth } = await import("../test/render");
	return { useAuth: () => fakeAuth() };
});

describe("keyboard operation of the shell (UI-09)", () => {
	it("the mobile menu is a dialog that Escape closes, returning focus to its button", async () => {
		renderPage(
			<Layout>
				<h1>Page</h1>
			</Layout>,
		);
		const opener = screen.getByRole("button", { name: "Open menu" });
		await userEvent.click(opener);

		expect(await screen.findByRole("dialog", { name: "Navigation menu" })).toBeInTheDocument();
		await userEvent.keyboard("{Escape}");

		expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
		expect(opener).toHaveFocus();
	});

	it("offers a skip link to the main content as the first tab stop", async () => {
		renderPage(
			<Layout>
				<h1>Page</h1>
			</Layout>,
		);
		await userEvent.tab();
		const skip = screen.getByRole("link", { name: "Skip to content" });
		expect(skip).toHaveFocus();
		expect(skip).toHaveAttribute("href", "#main");
		expect(document.getElementById("main")).toContainElement(screen.getByRole("heading", { name: "Page" }));
	});
});
