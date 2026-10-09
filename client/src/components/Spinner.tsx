export function Spinner({ size = "sm" }: { size?: "sm" | "md" }) {
	const dimension = size === "sm" ? "h-4 w-4" : "h-6 w-6";
	return (
		<span
			className={`inline-block ${dimension} animate-spin rounded-full border-2 border-current border-t-transparent`}
			aria-hidden="true"
		/>
	);
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
	return (
		<div className="flex items-center gap-2 py-10 text-sm text-gray-500">
			<Spinner />
			<span>{label}</span>
		</div>
	);
}
