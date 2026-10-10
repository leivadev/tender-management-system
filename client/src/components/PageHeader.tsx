import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
	label: string;
	to?: string;
}

export function PageHeader({
	title,
	description,
	crumbs,
	badge,
	actions,
}: {
	title: ReactNode;
	description?: ReactNode;
	crumbs?: Crumb[];
	badge?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="mb-6">
			{crumbs && crumbs.length > 0 && (
				<nav
					aria-label="Breadcrumb"
					className="mb-2 flex items-center gap-1 text-[13px] text-muted-foreground"
				>
					{crumbs.map((crumb, i) => (
						<span key={crumb.label} className="flex items-center gap-1">
							{i > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
							{crumb.to ? (
								<Link to={crumb.to} className="hover:text-foreground">
									{crumb.label}
								</Link>
							) : (
								<span aria-current="page" className="font-medium text-foreground">
									{crumb.label}
								</span>
							)}
						</span>
					))}
				</nav>
			)}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-xl font-semibold tracking-tight">{title}</h1>
						{badge}
					</div>
					{description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
				</div>
				{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
			</div>
		</div>
	);
}
