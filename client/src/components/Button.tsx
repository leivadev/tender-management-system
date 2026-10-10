import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "link" | "info" | "warning" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
	primary: "bg-primary text-primary-foreground shadow-xs hover:brightness-110",
	secondary: "border border-border bg-card text-foreground shadow-xs hover:bg-muted",
	danger:
		"border border-[color:var(--tone-negative-fg)]/30 bg-card text-destructive hover:bg-[color:var(--tone-negative-bg)]",
	link: "h-auto px-0 text-primary hover:underline",
	info: "bg-primary-soft text-primary hover:brightness-95",
	warning: "bg-[color:var(--tone-warning-bg)] text-[color:var(--tone-warning-fg)] hover:brightness-95",
	ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

export function Button({
	variant = "primary",
	loading,
	disabled,
	className,
	children,
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cn(
				"inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-ctl px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
				VARIANT_CLASSES[variant],
				className,
			)}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Spinner />}
			{children}
		</button>
	);
}
