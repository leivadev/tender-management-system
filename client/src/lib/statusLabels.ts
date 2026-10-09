import type { TenderStatus } from "../api/types";

export const STATUS_LABELS: Record<TenderStatus, string> = {
	draft: "Draft",
	active: "Active",
	finalized: "Finalized",
	for_collection: "For collection",
	collected: "Collected",
	lost: "Lost",
};

export const STATUS_COLORS: Record<TenderStatus, string> = {
	draft: "bg-gray-100 text-gray-700",
	active: "bg-blue-100 text-blue-700",
	finalized: "bg-indigo-100 text-indigo-700",
	for_collection: "bg-amber-100 text-amber-700",
	collected: "bg-green-100 text-green-700",
	lost: "bg-red-100 text-red-700",
};
