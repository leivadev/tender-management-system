import type { TenderStatus } from "../api/types";
import { STATUS_COLORS, STATUS_LABELS } from "../lib/statusLabels";

export function StatusBadge({ status }: { status: TenderStatus }) {
	return (
		<span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
			{STATUS_LABELS[status]}
		</span>
	);
}
