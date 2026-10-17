import type { ReactNode } from "react";

interface FieldProps {
	label: string;
	htmlFor: string;
	error?: string;
	hint?: string;
	children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
	const helpText = error ?? hint;

	return (
		<div>
			<label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-foreground">
				{label}
			</label>
			{children}
			<p className={`mt-1 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
				{helpText ?? "\u00A0"}
			</p>
		</div>
	);
}

/** UI-02: server validation message under an input that lives in a table cell instead of a <Field>. */
export function InlineFieldError({ id, message }: { id: string; message?: string }) {
	if (!message) return null;
	return (
		<p id={id} className="mt-1 text-xs text-destructive">
			{message}
		</p>
	);
}

/** Keeps a lone button vertically aligned with sibling <Field>s in an items-end flex row. */
export function FieldButtonSlot({ children }: { children: ReactNode }) {
	return (
		<div>
			<p className="mb-1 block text-[13px] text-transparent select-none" aria-hidden="true">
				&nbsp;
			</p>
			{children}
			<p className="mt-1 text-xs text-transparent select-none" aria-hidden="true">
				&nbsp;
			</p>
		</div>
	);
}
