import type { TenderStatus } from "../api/types";
import type { Tone } from "../components/Badge";

export const STATUS_LABELS: Record<TenderStatus, string> = {
	draft: "Draft",
	active: "Active",
	finalized: "Finalized",
	for_collection: "For collection",
	collected: "Collected",
	lost: "Lost",
};

export const STATUS_TONES: Record<TenderStatus, Tone> = {
	draft: "neutral",
	active: "info",
	finalized: "accent",
	for_collection: "warning",
	collected: "positive",
	lost: "negative",
};
