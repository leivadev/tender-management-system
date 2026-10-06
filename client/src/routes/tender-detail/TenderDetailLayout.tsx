import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageLoader } from "../../components/Spinner";
import { useTender } from "../../hooks/useTenders";
import { TenderStepper } from "./TenderStepper";

const TABS = [
	{ to: "", label: "Resumen", end: true },
	{ to: "productos", label: "Productos" },
	{ to: "propuesta", label: "Propuesta" },
	{ to: "pagos", label: "Pagos" },
	{ to: "historial", label: "Historial" },
];

export function TenderDetailLayout() {
	const { id } = useParams<{ id: string }>();
	const tenderQuery = useTender(id ?? "");

	if (tenderQuery.isLoading) return <PageLoader />;
	if (tenderQuery.error) return <ErrorMessage error={tenderQuery.error} />;
	if (!tenderQuery.data) return null;

	const tender = tenderQuery.data;

	return (
		<div className="space-y-6">
			<div>
				<Link to="/tenders" className="text-sm text-gray-500 hover:text-gray-700">
					← Licitaciones
				</Link>
				<h1 className="mt-1 text-lg font-semibold text-gray-900">{tender.title}</h1>
				<TenderStepper tender={tender} />
			</div>

			<div className="flex gap-4 overflow-x-auto border-b border-gray-200">
				{TABS.map((tab) => (
					<NavLink
						key={tab.to}
						to={tab.to}
						end={tab.end}
						className={({ isActive }) =>
							`shrink-0 border-b-2 px-1 pb-2 text-sm transition-colors ${
								isActive
									? "border-blue-600 font-medium text-blue-600"
									: "border-transparent text-gray-600 hover:text-gray-900"
							}`
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
