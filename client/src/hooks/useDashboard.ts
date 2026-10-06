import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "../api/dashboard";

export function useDashboardSummary(withinHours = 72) {
	return useQuery({
		queryKey: ["dashboard", { withinHours }],
		queryFn: () => getDashboardSummary(withinHours),
		refetchInterval: 60_000,
	});
}
