import { FileText, Plus, SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { TenderSort } from "../api/tenders";
import { type ArchivedFilter, TENDER_STATUSES, type TenderStatus } from "../api/types";
import { Badge } from "../components/Badge";
import { buttonClasses } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { TableSkeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { SortTH, Table, TBody, TD, TH, THead, TR } from "../components/Table";
import { useTenders } from "../hooks/useTenders";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/cn";
import { formatCurrency, formatShortDate } from "../lib/format";
import { inputClass } from "../lib/formStyles";
import { STATUS_LABELS } from "../lib/statusLabels";

const SORTS: TenderSort[] = ["created", "deadline", "budget", "title"];

function isTenderStatus(value: string | null): value is TenderStatus {
	return TENDER_STATUSES.includes(value as TenderStatus);
}

function isSort(value: string | null): value is TenderSort {
	return SORTS.includes(value as TenderSort);
}

export function TenderListPage() {
	const { canWrite, isAdmin } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();

	const statusParam = searchParams.get("status");
	const status = isTenderStatus(statusParam) ? statusParam : undefined;
	const q = searchParams.get("q") ?? "";
	const sortParam = searchParams.get("sort");
	const sort = isSort(sortParam) ? sortParam : "created";
	const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
	const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);
	const archivedParam = searchParams.get("archived");
	const archived: ArchivedFilter | undefined =
		archivedParam === "only" || archivedParam === "include" ? archivedParam : undefined;

	/** Rewrites the query string; any filter change goes back to page 1 unless `page` is given. */
	function update(next: {
		status?: TenderStatus;
		q?: string;
		sort?: TenderSort;
		dir?: "asc" | "desc";
		archived?: ArchivedFilter | undefined;
		page?: number;
	}) {
		const merged = { status, q, sort, dir, archived, page: 1, ...next };
		const params = new URLSearchParams();
		if (merged.status) params.set("status", merged.status);
		if (merged.q) params.set("q", merged.q);
		if (merged.sort !== "created" || merged.dir !== "desc") {
			params.set("sort", merged.sort);
			params.set("dir", merged.dir);
		}
		if (merged.archived) params.set("archived", merged.archived);
		if (merged.page > 1) params.set("page", String(merged.page));
		setSearchParams(params);
	}

	function toggleSort(column: TenderSort) {
		if (sort !== column) update({ sort: column, dir: column === "title" ? "asc" : "desc" });
		else update({ dir: dir === "asc" ? "desc" : "asc" });
	}

	const sortDirection = (column: TenderSort) => (sort === column ? dir : undefined);

	const tendersQuery = useTenders(page, {
		status,
		q: q || undefined,
		sort,
		dir,
		archived: isAdmin ? archived : undefined,
	});
	const filtered = Boolean(status || q || (isAdmin && archived));

	return (
		<>
			<PageHeader
				title="Tenders"
				description="Draft, send and follow every tender through to collection."
				actions={
					canWrite && (
						<Link to="/tenders/new" className={buttonClasses()}>
							<Plus className="size-3.5" aria-hidden="true" /> New tender
						</Link>
					)
				}
			/>

			<div className="space-y-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
						<legend className="sr-only">Filter by status</legend>
						{[undefined, ...TENDER_STATUSES].map((s) => (
							<button
								key={s ?? "all"}
								type="button"
								aria-pressed={status === s}
								onClick={() => update({ status: s })}
								className={cn(
									"h-7 rounded-full border px-3 text-xs font-medium transition-colors",
									status === s
										? "border-primary bg-primary-soft text-primary"
										: "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								{s ? STATUS_LABELS[s] : "All"}
							</button>
						))}
					</fieldset>
					<div className="flex flex-wrap items-center gap-3">
						{isAdmin && (
							<select
								aria-label="Archived tenders"
								value={archived ?? ""}
								onChange={(e) => update({ archived: (e.target.value || undefined) as ArchivedFilter })}
								className={`${inputClass} w-auto`}
							>
								<option value="">Active tenders</option>
								<option value="include">Active and archived</option>
								<option value="only">Archived only</option>
							</select>
						)}
						<SearchInput
							value={q}
							onSearch={(value) => update({ q: value })}
							placeholder="Search by title or client"
							className="w-full lg:w-72"
						/>
					</div>
				</div>

				{tendersQuery.error && <ErrorMessage error={tendersQuery.error} />}

				{tendersQuery.isLoading ? (
					<TableSkeleton rows={8} cols={6} />
				) : tendersQuery.data?.total === 0 ? (
					<EmptyState
						icon={filtered ? SearchX : FileText}
						title={filtered ? "No tenders match these filters" : "No tenders yet"}
						description={
							filtered
								? "Try a different search or clear the status filter."
								: "Create your first tender to start tracking it here."
						}
						action={
							filtered ? (
								<button
									type="button"
									onClick={() => setSearchParams({})}
									className="text-[13px] font-medium text-primary hover:underline"
								>
									Clear filters
								</button>
							) : undefined
						}
					/>
				) : (
					<Table>
						<THead>
							<tr>
								<SortTH direction={sortDirection("title")} onSort={() => toggleSort("title")}>
									Title
								</SortTH>
								<TH>Client</TH>
								<SortTH numeric direction={sortDirection("budget")} onSort={() => toggleSort("budget")}>
									Budget
								</SortTH>
								<SortTH direction={sortDirection("deadline")} onSort={() => toggleSort("deadline")}>
									Due
								</SortTH>
								<TH>Status</TH>
								<SortTH direction={sortDirection("created")} onSort={() => toggleSort("created")}>
									Created
								</SortTH>
							</tr>
						</THead>
						<TBody>
							{(tendersQuery.data?.data ?? []).map((tender) => (
								<TR key={tender.id}>
									<TD>
										<Link
											to={`/tenders/${tender.id}`}
											className="font-medium text-foreground hover:text-primary hover:underline"
										>
											{tender.title}
										</Link>{" "}
										{tender.archivedAt && <Badge>Archived</Badge>}
									</TD>
									<TD className="text-muted-foreground">{tender.clientName ?? "—"}</TD>
									<TD numeric>{formatCurrency(tender.maxBudget)}</TD>
									<TD className="whitespace-nowrap text-muted-foreground">
										{formatShortDate(tender.deadline)}
									</TD>
									<TD>
										<StatusBadge status={tender.status} />
									</TD>
									<TD className="whitespace-nowrap text-muted-foreground">
										{formatShortDate(tender.createdAt)}
									</TD>
								</TR>
							))}
						</TBody>
					</Table>
				)}

				{tendersQuery.data && (
					<Pagination meta={tendersQuery.data} onChange={(next) => update({ page: next })} />
				)}
			</div>
		</>
	);
}
