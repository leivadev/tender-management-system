import { Link, useSearchParams } from "react-router-dom";
import { TENDER_STATUSES, type TenderStatus } from "../api/types";
import { ErrorMessage } from "../components/ErrorMessage";
import { Pagination } from "../components/Pagination";
import { PageLoader } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useTenders } from "../hooks/useTenders";
import { useAuth } from "../lib/AuthContext";
import { formatCurrency, formatDate } from "../lib/format";
import { STATUS_LABELS } from "../lib/statusLabels";

function isTenderStatus(value: string | null): value is TenderStatus {
	return TENDER_STATUSES.includes(value as TenderStatus);
}

export function TenderListPage() {
	const { canWrite } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const statusParam = searchParams.get("status");
	const status = isTenderStatus(statusParam) ? statusParam : undefined;

	const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);

	function setStatus(next: TenderStatus | undefined) {
		setSearchParams(next ? { status: next } : {});
	}

	function setPage(next: number) {
		setSearchParams({ ...(status ? { status } : {}), page: String(next) });
	}

	const tendersQuery = useTenders(page, status);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setStatus(undefined)}
						className={`rounded-full px-3 py-1 text-sm transition-colors ${
							status === undefined ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
					>
						All
					</button>
					{TENDER_STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStatus(s)}
							className={`rounded-full px-3 py-1 text-sm transition-colors ${
								status === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
							}`}
						>
							{STATUS_LABELS[s]}
						</button>
					))}
				</div>
				{canWrite && (
					<Link
						to="/tenders/new"
						className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
					>
						New tender
					</Link>
				)}
			</div>

			{tendersQuery.error && <ErrorMessage error={tendersQuery.error} />}

			{tendersQuery.isLoading ? (
				<PageLoader />
			) : (
				<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Title</th>
								<th className="px-4 py-2">Client</th>
								<th className="px-4 py-2">Budget</th>
								<th className="px-4 py-2">Due</th>
								<th className="px-4 py-2">Status</th>
							</tr>
						</thead>
						<tbody>
							{(tendersQuery.data?.data ?? []).map((tender) => (
								<tr key={tender.id} className="border-t border-gray-100 hover:bg-gray-50">
									<td className="px-4 py-2">
										<Link to={`/tenders/${tender.id}`} className="text-blue-600 hover:underline">
											{tender.title}
										</Link>
									</td>
									<td className="px-4 py-2">{tender.clientName ?? "—"}</td>
									<td className="px-4 py-2">{formatCurrency(tender.maxBudget)}</td>
									<td className="px-4 py-2">{formatDate(tender.deadline)}</td>
									<td className="px-4 py-2">
										<StatusBadge status={tender.status} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{tendersQuery.data?.total === 0 && (
						<p className="px-4 py-6 text-center text-sm text-gray-500">
							{status ? `No tenders with status "${STATUS_LABELS[status]}".` : "No tenders yet."}
						</p>
					)}
				</div>
			)}

			{tendersQuery.data && <Pagination meta={tendersQuery.data} onChange={setPage} />}
		</div>
	);
}
