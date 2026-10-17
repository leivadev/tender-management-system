import type { KeyboardEvent } from "react";

/**
 * UI-08: a table row cannot be a <form>, so an inline edit row handles Enter (save) and Escape (cancel)
 * itself. Enter on a button keeps its normal meaning (activate), Enter that confirms an IME composition
 * is left alone, and nothing fires while saving.
 */
export function inlineEditKeys({
	onSave,
	onCancel,
	busy,
}: {
	onSave: () => void;
	onCancel: () => void;
	busy: boolean;
}) {
	return (e: KeyboardEvent<HTMLElement>) => {
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		} else if (
			e.key === "Enter" &&
			!e.nativeEvent.isComposing &&
			!busy &&
			!(e.target instanceof HTMLButtonElement)
		) {
			e.preventDefault();
			onSave();
		}
	};
}
