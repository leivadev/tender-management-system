import type { ReactNode } from "react";

export type Tone = "neutral" | "info" | "accent" | "positive" | "warning" | "negative";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
			style={{ background: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` }}
		>
			<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
			{children}
		</span>
	);
}
