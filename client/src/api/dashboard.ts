import { fetchJson } from "./client";
import type { DashboardMetrics, DashboardSummary } from "./types";

export function getDashboardSummary(withinHours = 72) {
	return fetchJson<DashboardSummary>(`/api/dashboard?withinHours=${withinHours}`);
}

export function getDashboardMetrics() {
	return fetchJson<DashboardMetrics>("/api/dashboard/metrics");
}
