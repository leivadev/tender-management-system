import { fetchJson } from "./client";
import type { DashboardSummary } from "./types";

export function getDashboardSummary(withinHours = 72) {
	return fetchJson<DashboardSummary>(`/api/dashboard?withinHours=${withinHours}`);
}
