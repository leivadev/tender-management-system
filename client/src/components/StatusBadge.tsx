import type { TenderStatus } from "../api/types";
import { STATUS_LABELS, STATUS_TONES } from "../lib/statusLabels";
import { Badge } from "./Badge";

export function StatusBadge({ status }: { status: TenderStatus }) {
	return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
