import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError, mapErrorToMessage } from "../api/errors";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { useAuth } from "../lib/AuthContext";
import { inputClass } from "../lib/formStyles";

const DEMO_EMAIL = "demo@leivadev.com";
const DEMO_PASSWORD = "Demo-Tenders-2026";

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

	async function submit(emailValue: string, passwordValue: string) {
		setError(null);
		setSubmitting(true);
		try {
			await login(emailValue, passwordValue);
			navigate("/", { replace: true });
		} catch (err) {
			setError(err instanceof ApiError ? mapErrorToMessage(err) : "Could not log in.");
		} finally {
			setSubmitting(false);
		}
	}

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		void submit(email, password);
	}

	function handleDemoLogin() {
		setEmail(DEMO_EMAIL);
		setPassword(DEMO_PASSWORD);
		void submit(DEMO_EMAIL, DEMO_PASSWORD);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
			>
				<div>
					<h1 className="text-lg font-semibold text-gray-900">Log in</h1>
					<p className="mt-1 text-sm text-gray-500">Tender management system</p>
				</div>
				<Field label="Email" htmlFor="email">
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
				<Field label="Password" htmlFor="password">
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
					{submitting ? "Logging in…" : "Log in"}
				</Button>
				<div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
					<p className="font-medium">Demo account (read-only)</p>
					<p className="mt-1 font-mono text-xs">{DEMO_EMAIL}</p>
					<p className="font-mono text-xs">{DEMO_PASSWORD}</p>
					<Button
						type="button"
						variant="secondary"
						className="mt-2 w-full"
						loading={submitting}
						onClick={handleDemoLogin}
					>
						Log in with demo account
					</Button>
				</div>
			</form>
		</div>
	);
}
