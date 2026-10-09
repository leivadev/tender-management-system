export function formatCurrency(value: string | number): string {
	const n = typeof value === "string" ? Number(value) : value;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	}).format(n);
}

export function formatDate(value: string): string {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(value),
	);
}
