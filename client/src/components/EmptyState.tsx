import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
			<div className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
				<Icon className="size-5" aria-hidden="true" />
			</div>
			<p className="text-sm font-semibold">{title}</p>
			{description && <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
