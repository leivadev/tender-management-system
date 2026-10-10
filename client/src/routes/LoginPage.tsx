import { BookOpen, Code, Eye, FileText } from "lucide-react";
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
			if (err instanceof ApiError) {
				setError(err.code === "UNAUTHENTICATED" ? "Invalid email or password." : mapErrorToMessage(err));
			} else {
				setError("Could not log in.");
			}
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
		<div className="grid min-h-screen lg:grid-cols-2">
			<main className="flex flex-col px-6 py-8 sm:px-12">
				<div className="flex items-center gap-2.5">
					<div className="grid size-7 place-items-center rounded-ctl bg-primary text-primary-foreground">
						<FileText className="size-4" aria-hidden="true" />
					</div>
					<span className="text-[13px] font-semibold tracking-tight">Tender Management System</span>
				</div>

				<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
					<h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
					<p className="mt-1.5 text-sm text-muted-foreground">Log in to manage your tenders.</p>

					<form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
							<p
								role="alert"
								className="rounded-ctl bg-[color:var(--tone-negative-bg)] px-3 py-2 text-sm text-[color:var(--tone-negative-fg)]"
							>
								{error}
							</p>
						)}
						<Button type="submit" loading={submitting} className="h-9 w-full">
							{submitting ? "Logging in…" : "Log in"}
						</Button>
					</form>

					<div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
						<span className="h-px flex-1 bg-border" />
						or explore the app
						<span className="h-px flex-1 bg-border" />
					</div>

					<Button variant="secondary" className="h-9 w-full" loading={submitting} onClick={handleDemoLogin}>
						<Eye className="size-3.5" /> Continue with the demo account
					</Button>
					<p className="mt-2 text-center text-xs text-muted-foreground">
						Read-only: browse everything, nothing can be changed.
					</p>
				</div>

				<footer className="mx-auto flex w-full max-w-sm items-center gap-4 text-xs text-muted-foreground">
					<a
						href="https://github.com/leivadev/tender-management-system"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						<Code className="size-3.5" aria-hidden="true" /> Source
					</a>
					<a
						href="/api/docs"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						<BookOpen className="size-3.5" aria-hidden="true" /> API docs
					</a>
					<span className="ml-auto">
						Built by{" "}
						<a
							href="https://leivadev.com"
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-foreground"
						>
							leivadev
						</a>
					</span>
				</footer>
			</main>

			<BrandPanel />
		</div>
	);
}

const PREVIEW_BARS = [38, 52, 30, 64, 48, 78, 58];
const PREVIEW_PIPELINE = [
	{ label: "Draft", width: "62%", color: "#8795a8" },
	{ label: "Active", width: "48%", color: "#8f7fff" },
	{ label: "Collected", width: "84%", color: "#34d3a6" },
];

/** Decorative product preview. Static markup, no data from the API. */
function BrandPanel() {
	return (
		<aside
			aria-hidden="true"
			className="relative hidden overflow-hidden bg-gray-900 p-12 text-white lg:flex lg:flex-col lg:justify-between"
		>
			<div className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-blue-600/40 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-blue-800/40 blur-3xl" />

			<div className="relative max-w-md">
				<h2 className="text-3xl leading-tight font-semibold tracking-tight">
					Every tender, from draft to collected.
				</h2>
				<p className="mt-3 text-sm text-gray-300">
					Draft proposals, track the pipeline, invoice and collect payments, with a full audit trail.
				</p>
			</div>

			<div className="relative mx-auto w-full max-w-md space-y-3">
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-card border border-white/10 bg-white/5 p-4 backdrop-blur">
						<p className="text-xs text-gray-300">Open pipeline</p>
						<p className="mt-1 font-mono text-xl font-semibold">$1.4M</p>
					</div>
					<div className="rounded-card border border-white/10 bg-white/5 p-4 backdrop-blur">
						<p className="text-xs text-gray-300">Won this month</p>
						<p className="mt-1 font-mono text-xl font-semibold">$299.9K</p>
					</div>
				</div>
				<div className="rounded-card border border-white/10 bg-white/5 p-4 backdrop-blur">
					<p className="text-xs text-gray-300">Won vs. collected</p>
					<div className="mt-3 flex h-24 items-end gap-2">
						{PREVIEW_BARS.map((h, i) => (
							<div key={i} className="flex-1 rounded-t bg-blue-400/80" style={{ height: `${h}%` }} />
						))}
					</div>
				</div>
				<div className="space-y-2 rounded-card border border-white/10 bg-white/5 p-4 backdrop-blur">
					<p className="text-xs text-gray-300">Pipeline by status</p>
					{PREVIEW_PIPELINE.map((row) => (
						<div key={row.label} className="flex items-center gap-3 text-xs">
							<span className="w-16 text-gray-300">{row.label}</span>
							<div className="h-1.5 flex-1 rounded-full bg-white/10">
								<div className="h-full rounded-full" style={{ width: row.width, background: row.color }} />
							</div>
						</div>
					))}
				</div>
			</div>
		</aside>
	);
}
