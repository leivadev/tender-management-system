import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useEffect, useState } from "react";
import { type ConfirmOptions, subscribeConfirm } from "../lib/confirm";
import { Button } from "./Button";

interface ConfirmState {
	options: ConfirmOptions;
	resolve: (value: boolean) => void;
}

export function ConfirmHost() {
	const [state, setState] = useState<ConfirmState | null>(null);

	useEffect(() => subscribeConfirm(setState), []);

	function close(value: boolean) {
		state?.resolve(value);
		setState(null);
	}

	return (
		<AlertDialog.Root open={state !== null} onOpenChange={(open) => !open && close(false)}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[1px]" />
				<AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-card p-5 shadow-card">
					<AlertDialog.Title className="text-sm font-semibold">{state?.options.title}</AlertDialog.Title>
					{state?.options.description && (
						<AlertDialog.Description className="mt-1.5 text-[13px] text-muted-foreground">
							{state.options.description}
						</AlertDialog.Description>
					)}
					<div className="mt-5 flex justify-end gap-2">
						<AlertDialog.Cancel asChild>
							<Button variant="secondary">Cancel</Button>
						</AlertDialog.Cancel>
						<AlertDialog.Action asChild>
							<Button variant={state?.options.destructive ? "danger" : "primary"} onClick={() => close(true)}>
								{state?.options.confirmLabel ?? "Confirm"}
							</Button>
						</AlertDialog.Action>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
}
