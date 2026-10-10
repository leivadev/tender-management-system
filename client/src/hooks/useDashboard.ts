import { useQuery } from "@tanstack/react-query";
import { getDashboardMetrics, getDashboardSummary } from "../api/dashboard";

export function useDashboardSummary(withinHours = 72) {
	return useQuery({
		queryKey: ["dashboard", { withinHours }],
		queryFn: () => getDashboardSummary(withinHours),
		refetchInterval: 60_000,
	});
}

export function useDashboardMetrics() {
	return useQuery({
		queryKey: ["dashboard", "metrics"],
		queryFn: getDashboardMetrics,
		refetchInterval: 60_000,
	});
}
