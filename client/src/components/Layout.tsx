import * as Dialog from "@radix-ui/react-dialog";
import {
	BookOpen,
	Building2,
	Code,
	FileText,
	LayoutDashboard,
	LogOut,
	Menu,
	Package,
	Search,
	Users,
	X,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/cn";
import { CommandPalette, useGlobalShortcuts } from "./CommandPalette";

const NAV_ITEMS = [
	{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
	{ to: "/tenders", label: "Tenders", icon: FileText },
	{ to: "/clients", label: "Clients", icon: Building2 },
	{ to: "/products", label: "Products", icon: Package },
	{ to: "/users", label: "Users", icon: Users, adminOnly: true },
	{ to: "/docs", label: "API docs", icon: BookOpen },
];

const SOURCE_LINKS = [
	{ href: "https://github.com/leivadev/tender-management-system", label: "GitHub repo", icon: Code },
];

function Brand() {
	return (
		<div className="flex items-center gap-2.5 px-2 py-1.5">
			<div className="grid size-7 place-items-center rounded-ctl bg-primary text-primary-foreground">
				<FileText className="size-4" aria-hidden="true" />
			</div>
			<span className="text-[13px] leading-tight font-semibold tracking-tight">
				Tender Management
				<br />
				System
			</span>
		</div>
	);
}

function SidebarContent({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
	const { email, logout, isAdmin, role: userRole } = useAuth();
	const role = userRole && { admin: "Administrator", user: "Writer", viewer: "Read-only viewer" }[userRole];
	const items = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);

	return (
		<>
			<Brand />
			<button
				type="button"
				onClick={() => {
					onNavigate?.();
					onSearch();
				}}
				className="mt-4 flex h-8 items-center gap-2 rounded-ctl border border-border bg-card px-2.5 text-[13px] text-muted-foreground shadow-xs transition-colors hover:bg-muted"
			>
				<Search className="size-3.5" aria-hidden="true" />
				<span className="flex-1 text-left">Search…</span>
				<kbd className="font-mono text-[10px]">⌘K</kbd>
			</button>
			<nav aria-label="Main" className="mt-4 flex flex-col gap-0.5">
				{items.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						onClick={onNavigate}
						className={({ isActive }) =>
							cn(
								"flex h-8 items-center gap-2.5 rounded-ctl px-2.5 text-[13px] font-medium transition-colors",
								isActive
									? "bg-primary-soft text-primary"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)
						}
					>
						<item.icon className="size-4" aria-hidden="true" />
						{item.label}
					</NavLink>
				))}
			</nav>

			<div className="mt-auto space-y-2">
				<div className="flex gap-1 px-1">
					{SOURCE_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
						>
							<link.icon className="size-3.5" aria-hidden="true" /> {link.label}
						</a>
					))}
				</div>
				<p className="px-2.5 text-[11px] text-muted-foreground">
					Built by{" "}
					<a
						href="https://leivadev.com"
						target="_blank"
						rel="noopener noreferrer"
						className="font-bold underline hover:text-foreground"
					>
						Leivadev
					</a>
				</p>
				<div className="flex items-center gap-2.5 rounded-card border border-border bg-card p-2">
					<div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary uppercase">
						{email?.[0] ?? "?"}
					</div>
					<div className="min-w-0 flex-1 leading-tight">
						<p className="truncate text-[13px] font-medium">{email}</p>
						<p className="truncate text-xs text-muted-foreground">{role}</p>
					</div>
					<button
						type="button"
						onClick={() => logout()}
						aria-label="Log out"
						title="Log out"
						className="grid size-7 shrink-0 place-items-center rounded-ctl text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<LogOut className="size-4" />
					</button>
				</div>
			</div>
		</>
	);
}

export function Layout({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const togglePalette = useCallback(() => setPaletteOpen((v) => !v), []);
	useGlobalShortcuts(togglePalette);
	return (
		<div className="min-h-screen lg:flex">
			<a
				href="#main"
				className="sr-only z-50 rounded-ctl bg-card px-3 py-2 text-[13px] font-medium shadow-card focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
			>
				Skip to content
			</a>
			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
			<aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar p-3 lg:flex">
				<SidebarContent onSearch={() => setPaletteOpen(true)} />
			</aside>

			<Dialog.Root open={open} onOpenChange={setOpen}>
				<div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-sidebar px-3 lg:hidden">
					<Brand />
					<Dialog.Trigger
						aria-label="Open menu"
						className="grid size-8 place-items-center rounded-ctl text-muted-foreground hover:bg-muted"
					>
						<Menu className="size-5" />
					</Dialog.Trigger>
				</div>

				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" />
					<Dialog.Content
						aria-describedby={undefined}
						className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar p-3 shadow-card lg:hidden"
					>
						<Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
						<Dialog.Close
							aria-label="Close menu"
							className="absolute top-3 right-3 grid size-7 place-items-center rounded-ctl text-muted-foreground hover:bg-muted"
						>
							<X className="size-4" />
						</Dialog.Close>
						<SidebarContent onNavigate={() => setOpen(false)} onSearch={() => setPaletteOpen(true)} />
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>

			<main id="main" className="min-w-0 flex-1">
				<div className="mx-auto w-full max-w-[1180px] px-4 py-6 lg:px-8">{children}</div>
			</main>
		</div>
	);
}
