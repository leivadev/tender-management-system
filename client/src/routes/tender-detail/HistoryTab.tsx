import { ErrorMessage } from "../../components/ErrorMessage";
import { StatusBadge } from "../../components/StatusBadge";
import { useTenderHistory } from "../../hooks/useTenders";
import { formatDate } from "../../lib/format";
import { useTenderContext } from "./context";

export function HistoryTab() {
	const { tender } = useTenderContext();
	const historyQuery = useTenderHistory(tender.id);

	if (historyQuery.error) return <ErrorMessage error={historyQuery.error} />;

	return (
		<ol className="space-y-3">
			{(historyQuery.data ?? []).map((row) => (
				<li
					key={row.id}
					className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm"
				>
					{row.fromStatus && <StatusBadge status={row.fromStatus} />}
					{row.fromStatus && <span className="text-gray-300">→</span>}
					<StatusBadge status={row.toStatus} />
					<span className="ml-auto text-gray-500">{formatDate(row.changedAt)}</span>
				</li>
			))}
			{historyQuery.data?.length === 0 && (
				<p className="text-center text-sm text-gray-500">No history yet.</p>
			)}
		</ol>
	);
}
