import type { TenderDetail, TenderStatus } from "../../api/types";
import { STATUS_LABELS } from "../../lib/statusLabels";

const HAPPY_PATH: TenderStatus[] = ["draft", "active", "finalized", "for_collection", "collected"];

export function TenderStepper({ tender }: { tender: TenderDetail }) {
	if (tender.status === "lost") {
		return (
			<div className="mt-3 flex items-center gap-2">
				{HAPPY_PATH.slice(0, HAPPY_PATH.indexOf("active") + 1).map((status) => (
					<StepDot key={status} label={STATUS_LABELS[status]} state="done" />
				))}
				<span className="mx-1 text-gray-300">→</span>
				<StepDot label={STATUS_LABELS.lost} state="lost" />
			</div>
		);
	}

	const currentIndex = HAPPY_PATH.indexOf(tender.status);

	return (
		<div className="mt-3 flex items-center gap-2">
			{HAPPY_PATH.map((status, i) => (
				<div key={status} className="flex items-center gap-2">
					<StepDot
						label={STATUS_LABELS[status]}
						state={i < currentIndex ? "done" : i === currentIndex ? "current" : "pending"}
					/>
					{i < HAPPY_PATH.length - 1 && <span className="text-gray-300">→</span>}
				</div>
			))}
		</div>
	);
}

function StepDot({ label, state }: { label: string; state: "done" | "current" | "pending" | "lost" }) {
	const styles = {
		done: "bg-green-100 text-green-700",
		current: "bg-blue-600 text-white",
		pending: "bg-gray-100 text-gray-500",
		lost: "bg-red-100 text-red-700",
	}[state];

	return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}
