import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("animate-pulse rounded-ctl bg-muted", className)} aria-hidden="true" {...props} />
	);
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
	return (
		<div
			className="divide-y divide-border rounded-card border border-border bg-card shadow-card"
			role="status"
			aria-label="Loading"
		>
			{Array.from({ length: rows }, (_, r) => (
				<div key={r} className="flex h-10 items-center gap-6 px-4">
					{Array.from({ length: cols }, (_, c) => (
						<Skeleton key={c} className={cn("h-3", c === 0 ? "w-1/3" : "w-1/6")} />
					))}
				</div>
			))}
		</div>
	);
}
