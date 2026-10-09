import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import { useSearchParams } from "react-router-dom";
import { DashboardView } from "./DashboardView";
import { DetailView } from "./DetailView";
import { Shell } from "./Shell";
import "./variants.css";

const THEMES = [
	{ id: "ledger", label: "A · Ledger", hint: "Geist · indigo · hairlines" },
	{ id: "navy", label: "B · Fintech Navy", hint: "Inter · violet + teal · layered shadow" },
	{ id: "warm", label: "C · Warm Ops", hint: "IBM Plex · green + amber · paper" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

// Throwaway route to compare visual directions. Delete after picking one.
export function DesignPage() {
	const [params, setParams] = useSearchParams();
	const theme = (THEMES.find((t) => t.id === params.get("v"))?.id ?? "ledger") as ThemeId;
	const view = params.get("view") === "detail" ? "detail" : "dashboard";

	function set(next: Record<string, string>) {
		setParams({ v: theme, view, ...next });
	}

	return (
		<div data-theme={theme}>
			<div className="sticky top-0 z-20 flex h-11 items-center gap-2 border-b border-border bg-card px-4 font-ui text-[13px]">
				<span className="mr-2 font-semibold">Design variants</span>
				{THEMES.map((t) => (
					<button
						key={t.id}
						type="button"
						title={t.hint}
						onClick={() => set({ v: t.id })}
						className={`h-7 rounded-ctl px-2.5 font-medium ${
							t.id === theme ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
						}`}
					>
						{t.label}
					</button>
				))}
				<span className="ml-auto text-xs text-muted-foreground">
					{THEMES.find((t) => t.id === theme)?.hint}
				</span>
			</div>
			<Shell
				view={view}
				crumbs={view === "dashboard" ? ["Dashboard"] : ["Tenders", "TND-1038"]}
				onNavigate={(v) => set({ view: v })}
			>
				{view === "dashboard" ? <DashboardView /> : <DetailView />}
			</Shell>
		</div>
	);
}
