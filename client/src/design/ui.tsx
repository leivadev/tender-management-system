import type { ReactNode } from "react";
import type { TenderStatus } from "../api/types";
import { STATUS_LABELS } from "../lib/statusLabels";

export type Tone = "neutral" | "info" | "accent" | "positive" | "warning" | "negative";

export const STATUS_TONE: Record<TenderStatus, Tone> = {
	draft: "neutral",
	active: "info",
	finalized: "accent",
	for_collection: "warning",
	collected: "positive",
	lost: "negative",
};

export function usd(n: number, compact = false): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: compact ? 1 : 0,
		notation: compact ? "compact" : "standard",
	}).format(n);
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
			style={{ background: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` }}
		>
			<span className="size-1.5 rounded-full bg-current" />
			{children}
		</span>
	);
}

export function StatusPill({ status }: { status: TenderStatus }) {
	return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`rounded-card border border-border bg-card shadow-card ${className}`}>{children}</div>
	);
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
	return (
		<div className="flex items-center justify-between border-b border-border px-4 py-3">
			<h3 className="text-sm font-semibold tracking-tight">{title}</h3>
			{action}
		</div>
	);
}

export function Btn({
	variant = "secondary",
	icon,
	children,
	onClick,
}: {
	variant?: "primary" | "secondary" | "ghost";
	icon?: ReactNode;
	children: ReactNode;
	onClick?: () => void;
}) {
	const styles = {
		primary: "bg-primary text-primary-foreground hover:opacity-90",
		secondary: "border border-border bg-card text-foreground hover:bg-muted",
		ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
	}[variant];
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex h-8 items-center gap-1.5 rounded-ctl px-3 text-[13px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 ${styles}`}
		>
			{icon}
			{children}
		</button>
	);
}

export function Kbd({ children }: { children: ReactNode }) {
	return (
		<kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-data text-[10px] text-muted-foreground">
			{children}
		</kbd>
	);
}
