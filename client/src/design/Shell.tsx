import {
	BookOpen,
	Building2,
	ChevronRight,
	Code,
	FileText,
	LayoutDashboard,
	Lock,
	Package,
	Plus,
	Search,
	Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Btn, Kbd } from "./ui";

const NAV = [
	{ label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
	{ label: "Tenders", icon: FileText, view: "detail", count: 48 },
	{ label: "Clients", icon: Building2, view: null },
	{ label: "Products", icon: Package, view: null },
] as const;

export function Shell({
	view,
	crumbs,
	onNavigate,
	children,
}: {
	view: "dashboard" | "detail";
	crumbs: string[];
	onNavigate: (v: "dashboard" | "detail") => void;
	children: ReactNode;
}) {
	return (
		<div className="flex min-h-[calc(100vh-44px)] bg-background font-ui text-[length:var(--fs)] text-foreground">
			<aside className="sticky top-11 flex h-[calc(100vh-44px)] w-60 shrink-0 flex-col border-r border-border bg-sidebar p-3">
				<div className="flex items-center gap-2.5 px-2 py-1.5">
					<div className="grid size-7 place-items-center rounded-ctl bg-primary text-primary-foreground">
						<FileText className="size-4" />
					</div>
					<span className="text-[13px] font-semibold leading-tight tracking-tight">
						Tender Management
						<br />
						System
					</span>
				</div>

				<nav className="mt-5 flex flex-col gap-0.5">
					{NAV.map((item) => {
						const active = item.view === view;
						return (
							<button
								key={item.label}
								type="button"
								onClick={() => item.view && onNavigate(item.view)}
								className={`flex h-8 items-center gap-2.5 rounded-ctl px-2.5 text-[13px] font-medium transition ${
									active
										? "bg-primary-soft text-primary"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`}
							>
								<item.icon className="size-4" />
								{item.label}
								{"count" in item && (
									<span className="ml-auto font-data text-[11px] text-muted-foreground">{item.count}</span>
								)}
							</button>
						);
					})}
					<p className="mt-4 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
						Admin
					</p>
					<div className="flex h-8 items-center gap-2.5 rounded-ctl px-2.5 text-[13px] font-medium text-muted-foreground">
						<Users className="size-4" />
						Users
						<Lock className="ml-auto size-3" />
					</div>
				</nav>

				<div className="mt-auto space-y-2">
					<div className="flex gap-1 px-1 text-muted-foreground">
						<a
							href="https://github.com/leivadev/tender-management-system"
							className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:text-foreground"
						>
							<Code className="size-3.5" /> Source
						</a>
						<a
							href="/api/docs"
							className="flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:text-foreground"
						>
							<BookOpen className="size-3.5" /> API docs
						</a>
					</div>
					<div className="flex items-center gap-2.5 rounded-card border border-border bg-card p-2">
						<div className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
							D
						</div>
						<div className="min-w-0 leading-tight">
							<p className="truncate text-[13px] font-medium">Demo account</p>
							<p className="truncate text-xs text-muted-foreground">Read-only viewer</p>
						</div>
					</div>
				</div>
			</aside>

			<div className="min-w-0 flex-1">
				<header className="sticky top-11 z-10 flex h-12 items-center gap-3 border-b border-border bg-background/90 px-6 backdrop-blur">
					<nav className="flex items-center gap-1 text-[13px] text-muted-foreground">
						{crumbs.map((c, i) => (
							<span key={c} className="flex items-center gap-1">
								{i > 0 && <ChevronRight className="size-3.5" />}
								<span className={i === crumbs.length - 1 ? "font-medium text-foreground" : ""}>{c}</span>
							</span>
						))}
					</nav>
					<button
						type="button"
						className="ml-auto flex h-8 w-64 items-center gap-2 rounded-ctl border border-border bg-card px-2.5 text-[13px] text-muted-foreground"
					>
						<Search className="size-3.5" />
						Search tenders, clients…
						<span className="ml-auto flex gap-1">
							<Kbd>⌘</Kbd>
							<Kbd>K</Kbd>
						</span>
					</button>
					<Btn variant="primary" icon={<Plus className="size-3.5" />}>
						New tender
					</Btn>
				</header>
				<main className="mx-auto max-w-[1180px] p-6">{children}</main>
			</div>
		</div>
	);
}
