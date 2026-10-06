import { formatCurrency } from "../lib/format";

export function BudgetBar({ used, max, label }: { used: number; max: number; label: string }) {
	const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
	const overBudget = used > max;

	return (
		<div>
			<div className="mb-1 flex justify-between text-sm text-gray-600">
				<span>{label}</span>
				<span className={overBudget ? "font-medium text-red-600" : ""}>
					{formatCurrency(used)} / {formatCurrency(max)}
				</span>
			</div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
				<div
					className={`h-full rounded-full ${overBudget ? "bg-red-500" : "bg-blue-500"}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}
