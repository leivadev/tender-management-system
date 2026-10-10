import { Check, X } from "lucide-react";
import type { TenderDetail, TenderStatus } from "../../api/types";
import { Card } from "../../components/Card";
import { cn } from "../../lib/cn";
import { STATUS_LABELS } from "../../lib/statusLabels";

const HAPPY_PATH: TenderStatus[] = ["draft", "active", "finalized", "for_collection", "collected"];

type StepState = "done" | "current" | "pending" | "lost";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function enteredAt(tender: TenderDetail, status: TenderStatus): string | null {
	const row = tender.history.find((h) => h.toStatus === status);
	if (row) return shortDate.format(new Date(row.changedAt));
	return status === "draft" ? shortDate.format(new Date(tender.createdAt)) : null;
}

export function TenderStepper({ tender }: { tender: TenderDetail }) {
	const lost = tender.status === "lost";
	const steps: TenderStatus[] = lost ? ["draft", "active", "lost"] : HAPPY_PATH;
	const currentIndex = steps.indexOf(tender.status);

	return (
		<Card className="px-4 py-4">
			<ol className="flex items-start">
				{steps.map((status, i) => {
					const state: StepState =
						status === "lost"
							? "lost"
							: i < currentIndex
								? "done"
								: i === currentIndex
									? "current"
									: "pending";
					const reached = state !== "pending";
					return (
						<li key={status} className="flex flex-1 items-start last:flex-none">
							<div className="flex min-w-16 flex-col items-center gap-1.5">
								<StepDot state={state} index={i + 1} />
								<p className={cn("text-xs", state === "pending" ? "text-muted-foreground" : "font-semibold")}>
									{STATUS_LABELS[status]}
								</p>
								<p className="font-mono text-[11px] text-muted-foreground">
									{reached ? (enteredAt(tender, status) ?? "—") : "—"}
								</p>
							</div>
							{i < steps.length - 1 && (
								<div className={cn("mt-3 h-px flex-1", i < currentIndex ? "bg-primary" : "bg-border")} />
							)}
						</li>
					);
				})}
			</ol>
		</Card>
	);
}

function StepDot({ state, index }: { state: StepState; index: number }) {
	const styles: Record<StepState, string> = {
		done: "border-primary bg-primary text-primary-foreground",
		current: "border-primary bg-primary-soft text-primary ring-4 ring-primary/15",
		pending: "border-border bg-card text-muted-foreground",
		lost: "border-destructive bg-destructive text-white",
	};
	return (
		<div
			className={cn(
				"grid size-6 place-items-center rounded-full border text-xs font-semibold",
				styles[state],
			)}
			aria-current={state === "current" ? "step" : undefined}
		>
			{state === "done" ? (
				<Check className="size-3.5" />
			) : state === "lost" ? (
				<X className="size-3.5" />
			) : (
				index
			)}
		</div>
	);
}
