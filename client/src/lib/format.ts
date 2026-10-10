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

export function formatShortDate(value: string): string {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function formatCompactCurrency(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

const relativeFormat = new Intl.RelativeTimeFormat("en-US", { numeric: "auto", style: "short" });

/** "in 6 hr." / "2 days ago" style label for an ISO timestamp, relative to `now`. */
export function formatRelative(value: string, now = Date.now()): string {
	const diffMs = new Date(value).getTime() - now;
	const abs = Math.abs(diffMs);
	const minutes = Math.round(diffMs / 60_000);
	if (abs < 3_600_000) return relativeFormat.format(minutes, "minute");
	if (abs < 86_400_000) return relativeFormat.format(Math.round(diffMs / 3_600_000), "hour");
	return relativeFormat.format(Math.round(diffMs / 86_400_000), "day");
}
