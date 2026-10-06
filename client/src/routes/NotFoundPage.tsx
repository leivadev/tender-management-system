import { Link } from "react-router-dom";

export function NotFoundPage() {
	return (
		<div className="py-16 text-center">
			<h1 className="text-xl font-semibold text-gray-900">Página no encontrada</h1>
			<Link to="/" className="mt-2 inline-block text-blue-600 hover:underline">
				Volver al dashboard
			</Link>
		</div>
	);
}
