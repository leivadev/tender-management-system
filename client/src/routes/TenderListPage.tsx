import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TENDER_STATUSES, type TenderStatus } from "../api/types";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageLoader } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import { useClients } from "../hooks/useClients";
import { useTenders } from "../hooks/useTenders";
import { formatCurrency, formatDate } from "../lib/format";
import { STATUS_LABELS } from "../lib/statusLabels";

function isTenderStatus(value: string | null): value is TenderStatus {
	return TENDER_STATUSES.includes(value as TenderStatus);
}

export function TenderListPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const statusParam = searchParams.get("status");
	const status = isTenderStatus(statusParam) ? statusParam : undefined;

	function setStatus(next: TenderStatus | undefined) {
		setSearchParams(next ? { status: next } : {});
	}

	const tendersQuery = useTenders(status);
	const clientsQuery = useClients();

	const clientNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const client of clientsQuery.data ?? []) map.set(client.id, client.name);
		return map;
	}, [clientsQuery.data]);

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
						Todas
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
				<Link
					to="/tenders/new"
					className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
				>
					Nueva licitación
				</Link>
			</div>

			{tendersQuery.error && <ErrorMessage error={tendersQuery.error} />}

			{tendersQuery.isLoading ? (
				<PageLoader />
			) : (
				<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Título</th>
								<th className="px-4 py-2">Cliente</th>
								<th className="px-4 py-2">Presupuesto</th>
								<th className="px-4 py-2">Vence</th>
								<th className="px-4 py-2">Estado</th>
							</tr>
						</thead>
						<tbody>
							{(tendersQuery.data ?? []).map((tender) => (
								<tr key={tender.id} className="border-t border-gray-100 hover:bg-gray-50">
									<td className="px-4 py-2">
										<Link to={`/tenders/${tender.id}`} className="text-blue-600 hover:underline">
											{tender.title}
										</Link>
									</td>
									<td className="px-4 py-2">{clientNameById.get(tender.clientId) ?? "—"}</td>
									<td className="px-4 py-2">{formatCurrency(tender.maxBudget)}</td>
									<td className="px-4 py-2">{formatDate(tender.deadline)}</td>
									<td className="px-4 py-2">
										<StatusBadge status={tender.status} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{tendersQuery.data?.length === 0 && (
						<p className="px-4 py-6 text-center text-sm text-gray-500">
							{status
								? `No hay licitaciones en estado "${STATUS_LABELS[status]}".`
								: "No hay licitaciones todavía."}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
