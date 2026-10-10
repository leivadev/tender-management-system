import { History } from "lucide-react";
import { Card, CardHeader } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Skeleton } from "../../components/Skeleton";
import { useTenderHistory } from "../../hooks/useTenders";
import { formatDate } from "../../lib/format";
import { STATUS_LABELS, STATUS_TONES } from "../../lib/statusLabels";
import { useTenderContext } from "./context";

export function HistoryTab() {
	const { tender } = useTenderContext();
	const historyQuery = useTenderHistory(tender.id);

	if (historyQuery.error) return <ErrorMessage error={historyQuery.error} />;

	const rows = [...(historyQuery.data ?? [])].sort(
		(a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
	);

	return (
		<Card className="max-w-2xl">
			<CardHeader title="Status history" />
			{historyQuery.isLoading ? (
				<div className="space-y-3 p-4">
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="h-4 w-1/2" />
				</div>
			) : rows.length === 0 ? (
				<EmptyState icon={History} title="No history yet" description="Status changes will appear here." />
			) : (
				<ol className="px-4 py-3">
					{rows.map((row, i) => (
						<li key={row.id} className="relative flex gap-3 pb-4 last:pb-0">
							{i < rows.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />}
							<span
								className="relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-card"
								style={{ background: `var(--tone-${STATUS_TONES[row.toStatus]}-fg)` }}
							/>
							<div className="min-w-0 text-[13px] leading-snug">
								<p className="font-medium">
									{row.fromStatus ? (
										<>
											{STATUS_LABELS[row.fromStatus]} → {STATUS_LABELS[row.toStatus]}
										</>
									) : (
										<>Created as {STATUS_LABELS[row.toStatus]}</>
									)}
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">{formatDate(row.changedAt)}</p>
							</div>
						</li>
					))}
				</ol>
			)}
		</Card>
	);
}
