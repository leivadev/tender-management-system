import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "link" | "info" | "warning";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
	primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500",
	secondary: "border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400",
	danger: "border border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-400",
	link: "text-red-600 hover:underline focus-visible:ring-red-400 px-0 py-0",
	info: "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500",
	warning: "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500",
};

export function Button({
	variant = "primary",
	loading,
	disabled,
	className = "",
	children,
	...props
}: ButtonProps) {
	const base =
		variant === "link"
			? "inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
			: "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

	return (
		<button
			className={`${base} ${VARIANT_CLASSES[variant]} ${className}`}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Spinner />}
			{children}
		</button>
	);
}
