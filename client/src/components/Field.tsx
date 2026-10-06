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
			<label htmlFor={htmlFor} className="mb-1 block text-sm text-gray-600">
				{label}
			</label>
			{children}
			<p className={`mt-1 text-xs ${error ? "text-red-600" : "text-gray-400"}`}>{helpText ?? " "}</p>
		</div>
	);
}

/** Keeps a lone button vertically aligned with sibling <Field>s in an items-end flex row. */
export function FieldButtonSlot({ children }: { children: ReactNode }) {
	return (
		<div>
			<p className="mb-1 block text-sm text-transparent select-none" aria-hidden="true">
				&nbsp;
			</p>
			{children}
			<p className="mt-1 text-xs text-transparent select-none" aria-hidden="true">
				&nbsp;
			</p>
		</div>
	);
}
