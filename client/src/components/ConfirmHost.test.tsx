import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmAction } from "../lib/confirm";
import { ConfirmHost } from "./ConfirmHost";

afterEach(() => vi.restoreAllMocks());

describe("confirmations (UI-05)", () => {
	it("open an in-app alert dialog, never the native one", async () => {
		const nativeConfirm = vi.spyOn(window, "confirm");
		render(<ConfirmHost />);

		const answer = confirmAction({ title: "Archive client?", confirmLabel: "Archive client" });
		const dialog = await screen.findByRole("alertdialog", { name: "Archive client?" });
		expect(dialog).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Archive client" }));
		await expect(answer).resolves.toBe(true);
		expect(nativeConfirm).not.toHaveBeenCalled();
	});

	it("resolve false on Escape", async () => {
		render(<ConfirmHost />);
		const answer = confirmAction({ title: "Archive client?" });
		await screen.findByRole("alertdialog");

		await userEvent.keyboard("{Escape}");
		await expect(answer).resolves.toBe(false);
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
	});

	it("do not fall back to window.confirm when the host is not mounted", async () => {
		const nativeConfirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		await expect(confirmAction({ title: "Archive client?" })).resolves.toBe(false);
		expect(nativeConfirm).not.toHaveBeenCalled();
	});
});
