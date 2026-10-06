export function formatCurrency(value: string | number): string {
	const n = typeof value === "string" ? Number(value) : value;
	return new Intl.NumberFormat("es", { style: "currency", currency: "USD" }).format(n);
}

export function formatDate(value: string): string {
	return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
