import { Check, Clock, Cloud, Code, Database, Eye, FileText, HardDrive, Mail } from "lucide-react";
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
					<h1 className="text-2xl font-semibold tracking-tight">See it running</h1>
					<p className="mt-1.5 text-sm text-muted-foreground">
						Full-stack app to draft, send, track, resolve and collect on commercial tenders. Browse it with
						the read-only demo account.
					</p>

					<Button className="mt-5 h-10 w-full" loading={submitting} onClick={handleDemoLogin}>
						<Eye className="size-4" /> Enter the live demo
					</Button>
					{error && (
						<p
							role="alert"
							className="mt-3 rounded-ctl bg-[color:var(--tone-negative-bg)] px-3 py-2 text-sm text-[color:var(--tone-negative-fg)]"
						>
							{error}
						</p>
					)}
					<p className="mt-2 text-center text-xs text-muted-foreground">
						Read-only: browse everything, nothing can be changed.
					</p>

					<div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
						<span className="h-px flex-1 bg-border" />
						or log in with your account
						<span className="h-px flex-1 bg-border" />
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
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
						<Button type="submit" variant="secondary" loading={submitting} className="h-9 w-full">
							{submitting ? "Logging in…" : "Log in"}
						</Button>
					</form>
				</div>

				<footer className="mx-auto flex w-full max-w-sm items-center gap-4 text-xs text-muted-foreground">
					<a
						href="https://github.com/leivadev/tender-management-system"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						<Code className="size-3.5" aria-hidden="true" /> GitHub repo
					</a>
					<span className="ml-auto">
						Built by{" "}
						<a
							href="https://leivadev.com"
							target="_blank"
							rel="noopener noreferrer"
							className="font-bold text-foreground underline"
						>
							Leivadev
						</a>
					</span>
				</footer>
			</main>

			<BrandPanel />
		</div>
	);
}

const STACK = [
	{ icon: Cloud, name: "Cloudflare Workers", note: "Serves this SPA and the REST API" },
	{ icon: Database, name: "Postgres on Supabase", note: "Real tables, via Hyperdrive pooling" },
	{ icon: HardDrive, name: "R2 object storage", note: "Proposal PDFs, uploaded and downloaded" },
	{ icon: Mail, name: "Resend", note: "Transactional emails when a tender is sent" },
	{ icon: Clock, name: "Cron trigger", note: "Expires tenders and sends reminders" },
];

const TRY_IT = [
	"Dashboard: KPIs, won vs. collected, pipeline",
	"A tender's lifecycle, stepper and audit timeline",
	"Search and sort across hundreds of rows, or press ⌘K",
	"Role rules: the demo account is read-only",
];

/** Explains what is behind the demo. Static copy, no data from the API. */
function BrandPanel() {
	return (
		<aside className="relative hidden overflow-hidden bg-[#08142e] p-12 text-white lg:flex lg:flex-col lg:justify-center">
			<div className="pointer-events-none absolute -top-32 -right-24 size-[28rem] rounded-full bg-primary/40 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-primary/20 blur-3xl" />

			<div className="relative mx-auto w-full max-w-md">
				<h2 className="text-3xl leading-tight font-semibold tracking-tight">How it's built</h2>

				<ul className="mt-6 space-y-2.5">
					{STACK.map(({ icon: Icon, name, note }) => (
						<li
							key={name}
							className="flex items-center gap-3 rounded-card border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
						>
							<Icon className="size-4 shrink-0 text-white/80" aria-hidden="true" />
							<div>
								<p className="text-[13px] font-medium">{name}</p>
								<p className="text-xs text-white/60">{note}</p>
							</div>
						</li>
					))}
				</ul>

				<h3 className="mt-8 text-xs font-medium tracking-wide text-white/60 uppercase">Worth a look</h3>
				<ul className="mt-3 space-y-2 text-[13px] text-white/85">
					{TRY_IT.map((item) => (
						<li key={item} className="flex gap-2">
							<Check className="mt-0.5 size-3.5 shrink-0 text-[#34d3a6]" aria-hidden="true" />
							{item}
						</li>
					))}
				</ul>
			</div>
		</aside>
	);
}
