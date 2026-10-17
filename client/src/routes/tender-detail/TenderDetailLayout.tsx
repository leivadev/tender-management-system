import { NavLink, Outlet, useParams } from "react-router-dom";
import { Badge } from "../../components/Badge";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { useTender } from "../../hooks/useTenders";
import { cn } from "../../lib/cn";
import { formatCurrency } from "../../lib/format";
import { TenderActions } from "./TenderActions";
import { TenderStepper } from "./TenderStepper";

const TABS = [
	{ to: "", label: "Overview", end: true },
	{ to: "products", label: "Products" },
	{ to: "proposal", label: "Proposal" },
	{ to: "payments", label: "Payments" },
	{ to: "history", label: "History" },
];

function DetailSkeleton() {
	return (
		<div className="space-y-6">
			<h1 className="sr-only">Loading tender</h1>
			<div className="space-y-2">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-7 w-96 max-w-full" />
			</div>
			<Skeleton className="h-24 w-full" />
			<Skeleton className="h-64 w-full" />
		</div>
	);
}

export function TenderDetailLayout() {
	const { id } = useParams<{ id: string }>();
	const tenderQuery = useTender(id ?? "");

	if (tenderQuery.isLoading) return <DetailSkeleton />;
	if (tenderQuery.error)
		return (
			<>
				<PageHeader crumbs={[{ label: "Tenders", to: "/tenders" }]} title="Tender unavailable" />
				<ErrorMessage error={tenderQuery.error} />
			</>
		);
	if (!tenderQuery.data) return null;

	const tender = tenderQuery.data;

	return (
		<div className="space-y-5">
			<PageHeader
				crumbs={[{ label: "Tenders", to: "/tenders" }, { label: tender.title }]}
				title={tender.title}
				badge={
					<>
						<StatusBadge status={tender.status} />
						{tender.archivedAt && <Badge>Archived</Badge>}
					</>
				}
				description={[tender.clientName, `Budget ${formatCurrency(tender.maxBudget)}`]
					.filter(Boolean)
					.join(" · ")}
				actions={<TenderActions tender={tender} />}
			/>

			{tender.archivedAt && (
				<p className="rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground">
					This tender is archived and read-only. An administrator can restore it.
				</p>
			)}

			<TenderStepper tender={tender} />

			<div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
				{TABS.map((tab) => (
					<NavLink
						key={tab.to}
						to={tab.to}
						end={tab.end}
						className={({ isActive }) =>
							cn(
								"-mb-px shrink-0 border-b-2 px-3 pb-2 text-[13px] transition-colors",
								isActive
									? "border-primary font-medium text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)
						}
					>
						{tab.label}
					</NavLink>
				))}
			</div>

			<Outlet context={{ tender }} />
		</div>
	);
}
