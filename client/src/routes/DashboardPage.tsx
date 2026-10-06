import { Link } from "react-router-dom";
import { TENDER_STATUSES } from "../api/types";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageLoader } from "../components/Spinner";
import { useDashboardSummary } from "../hooks/useDashboard";
import { formatCurrency, formatDate } from "../lib/format";
import { STATUS_LABELS } from "../lib/statusLabels";

export function DashboardPage() {
	const { data, isLoading, error } = useDashboardSummary(72);

	if (isLoading) return <PageLoader />;
	if (error) return <ErrorMessage error={error} />;
	if (!data) return null;

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				{TENDER_STATUSES.map((status) => (
					<Link
						key={status}
						to={`/tenders?status=${status}`}
						className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
					>
						<p className="text-xs text-gray-500">{STATUS_LABELS[status]}</p>
						<p className="text-2xl font-semibold text-gray-900">{data.counts[status] ?? 0}</p>
					</Link>
				))}
			</div>

			<div className="rounded-lg border border-gray-200 bg-white">
				<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
					<h2 className="font-medium text-gray-900">Próximas a vencer (72h)</h2>
					<Link to="/tenders" className="text-sm text-blue-600 hover:underline">
						Ver todas
					</Link>
				</div>
				{data.upcoming.length === 0 ? (
					<p className="px-4 py-6 text-center text-sm text-gray-500">
						No hay licitaciones próximas a vencer.
					</p>
				) : (
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Título</th>
								<th className="px-4 py-2">Cliente</th>
								<th className="px-4 py-2">Presupuesto</th>
								<th className="px-4 py-2">Vence</th>
							</tr>
						</thead>
						<tbody>
							{data.upcoming.map((t) => (
								<tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
									<td className="px-4 py-2">
										<Link to={`/tenders/${t.id}`} className="text-blue-600 hover:underline">
											{t.title}
										</Link>
									</td>
									<td className="px-4 py-2">{t.clientName}</td>
									<td className="px-4 py-2">{formatCurrency(t.maxBudget)}</td>
									<td className="px-4 py-2">{formatDate(t.deadline)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
