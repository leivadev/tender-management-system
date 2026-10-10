import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../lib/cn";

/** Dense data table inside a bordered card. Scrolls horizontally on narrow screens. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
	return (
		<div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
			<table className={cn("w-full min-w-max text-left text-[13px]", className)} {...props} />
		</div>
	);
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
	return <thead className="bg-muted/50 text-xs text-muted-foreground" {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
	return <tbody className="divide-y divide-border" {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
	return <tr className={cn("h-10 transition-colors hover:bg-muted/40", className)} {...props} />;
}

export function TH({
	className,
	numeric,
	...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
	return (
		<th
			scope="col"
			className={cn("h-9 px-4 font-medium whitespace-nowrap", numeric && "text-right", className)}
			{...props}
		/>
	);
}

export function TD({
	className,
	numeric,
	...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
	return <td className={cn("px-4", numeric && "text-right font-mono tabular-nums", className)} {...props} />;
}
