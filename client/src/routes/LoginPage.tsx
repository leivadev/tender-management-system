import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, mapErrorToMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useAuth } from "../lib/AuthContext";
import { inputClass } from "../lib/formStyles";

export function LoginPage() {
	const { isAuthenticated, login } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (isAuthenticated) {
		const from = (location.state as { from?: string } | null)?.from ?? "/";
		return <Navigate to={from} replace />;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await login(email, password);
			navigate("/", { replace: true });
		} catch (err) {
			setError(err instanceof ApiError ? mapErrorToMessage(err) : "No se pudo iniciar sesión.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<div>
					<h1 className="text-lg font-semibold text-gray-900">Ingresar</h1>
					<p className="mt-1 text-sm text-gray-500">Sistema de gestión de licitaciones</p>
				</div>
				<Field label="Correo" htmlFor="email">
					<input
						id="email"
						type="email"
						autoComplete="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className={inputClass}
					/>
				</Field>
				<Field label="Contraseña" htmlFor="password">
					<input
						id="password"
						type="password"
						autoComplete="current-password"
						required
						minLength={1}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className={inputClass}
					/>
				</Field>
				{error && (
					<p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
						{error}
					</p>
				)}
				<Button type="submit" loading={submitting} className="w-full">
					{submitting ? "Ingresando…" : "Ingresar"}
				</Button>
			</form>
		</div>
	);
}
