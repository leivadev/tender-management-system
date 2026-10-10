import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("rounded-card border border-border bg-card shadow-card", className)} {...props} />
	);
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
			<h2 className="text-sm font-semibold tracking-tight">{title}</h2>
			{action}
		</div>
	);
}
