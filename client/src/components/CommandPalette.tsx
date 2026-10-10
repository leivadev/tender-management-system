import * as Dialog from "@radix-ui/react-dialog";
import {
	Building2,
	CornerDownLeft,
	FileText,
	LayoutDashboard,
	type LucideIcon,
	Package,
	Plus,
	Search,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "../hooks/useClients";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useTenders } from "../hooks/useTenders";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/cn";
import { STATUS_LABELS } from "../lib/statusLabels";

interface Item {
	id: string;
	group: string;
	label: string;
	hint?: string;
	shortcut?: string;
	icon: LucideIcon;
	to: string;
}

const MAX_RESULTS = 5;

/** Go-to shortcuts: press `g` then the key. Shared by the palette hints and the global listener. */
export const NAV_SHORTCUTS = [
	{ key: "d", label: "Dashboard", to: "/", icon: LayoutDashboard },
	{ key: "t", label: "Tenders", to: "/tenders", icon: FileText },
	{ key: "c", label: "Clients", to: "/clients", icon: Building2 },
	{ key: "p", label: "Products", to: "/products", icon: Package },
	{ key: "u", label: "Users", to: "/users", icon: Users, adminOnly: true },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Cmd/Ctrl+K toggles the palette; `g` then d/t/c/p/u jumps between sections. */
export function useGlobalShortcuts(toggle: () => void) {
	const navigate = useNavigate();
	const { isAdmin } = useAuth();

	useEffect(() => {
		let pendingG: number | undefined;

		function onKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				toggle();
				return;
			}
			if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;

			if (pendingG !== undefined) {
				window.clearTimeout(pendingG);
				pendingG = undefined;
				const target = NAV_SHORTCUTS.find((s) => s.key === e.key.toLowerCase());
				if (target && (!("adminOnly" in target) || isAdmin)) {
					e.preventDefault();
					navigate(target.to);
				}
				return;
			}
			if (e.key.toLowerCase() === "g") pendingG = window.setTimeout(() => (pendingG = undefined), 1000);
		}

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.clearTimeout(pendingG);
		};
	}, [navigate, toggle, isAdmin]);
}

export function CommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const { isAdmin, canWrite } = useAuth();
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const search = useDebouncedValue(query.trim(), 250);
	const searching = search.length >= 2;

	const tenders = useTenders(1, { q: searching ? search : undefined });
	const clients = useClients(1, searching ? search : undefined);

	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	const items = useMemo<Item[]>(() => {
		const needle = query.trim().toLowerCase();
		const matches = (label: string) => !needle || label.toLowerCase().includes(needle);

		const pages: Item[] = NAV_SHORTCUTS.filter((s) => !("adminOnly" in s) || isAdmin)
			.filter((s) => matches(s.label))
			.map((s) => ({
				id: `page-${s.to}`,
				group: "Go to",
				label: s.label,
				shortcut: `G ${s.key.toUpperCase()}`,
				icon: s.icon,
				to: s.to,
			}));

		const actions: Item[] =
			canWrite && matches("new tender create")
				? [{ id: "new-tender", group: "Actions", label: "New tender", icon: Plus, to: "/tenders/new" }]
				: [];

		const tenderResults: Item[] = searching
			? (tenders.data?.data ?? []).slice(0, MAX_RESULTS).map((t) => ({
					id: `tender-${t.id}`,
					group: "Tenders",
					label: t.title,
					hint: `${t.clientName ?? "—"} · ${STATUS_LABELS[t.status]}`,
					icon: FileText,
					to: `/tenders/${t.id}`,
				}))
			: [];

		const clientResults: Item[] = searching
			? (clients.data?.data ?? []).slice(0, MAX_RESULTS).map((c) => ({
					id: `client-${c.id}`,
					group: "Clients",
					label: c.name,
					hint: c.companyName,
					icon: Building2,
					to: `/clients?q=${encodeURIComponent(c.name)}`,
				}))
			: [];

		return [...tenderResults, ...clientResults, ...actions, ...pages];
	}, [query, searching, tenders.data, clients.data, isAdmin, canWrite]);

	useEffect(() => setActive(0), [items.length, query]);

	function go(item: Item | undefined) {
		if (!item) return;
		onOpenChange(false);
		navigate(item.to);
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActive((i) => (items.length ? (i + 1) % items.length : 0));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			go(items[active]);
		}
	}

	let lastGroup = "";
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
				<Dialog.Content
					aria-describedby={undefined}
					className="fixed top-[15vh] left-1/2 z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-card border border-border bg-card shadow-card"
				>
					<Dialog.Title className="sr-only">Command palette</Dialog.Title>
					<div className="flex items-center gap-2 border-b border-border px-3">
						<Search className="size-4 text-muted-foreground" aria-hidden="true" />
						<input
							// biome-ignore lint/a11y/noAutofocus: the palette exists to be typed into
							autoFocus
							role="combobox"
							aria-expanded="true"
							aria-controls="palette-list"
							aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder="Search tenders and clients, or jump to a page…"
							className="h-12 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
						/>
						<kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
							ESC
						</kbd>
					</div>

					<div id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
						{items.length === 0 && (
							<p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
								{searching && (tenders.isFetching || clients.isFetching) ? "Searching…" : "No results."}
							</p>
						)}
						{items.map((item, i) => {
							const header = item.group !== lastGroup;
							lastGroup = item.group;
							return (
								<div key={item.id}>
									{header && (
										<p className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">
											{item.group}
										</p>
									)}
									{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by the combobox input */}
									<div
										id={`palette-${item.id}`}
										role="option"
										tabIndex={-1}
										aria-selected={i === active}
										onClick={() => go(item)}
										onMouseMove={() => setActive(i)}
										className={cn(
											"flex cursor-pointer items-center gap-2.5 rounded-ctl px-2.5 py-2 text-[13px]",
											i === active && "bg-primary-soft text-primary",
										)}
									>
										<item.icon className="size-4 shrink-0" aria-hidden="true" />
										<span className="min-w-0 flex-1 truncate">{item.label}</span>
										{item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
										{item.shortcut && (
											<kbd className="font-mono text-[10px] text-muted-foreground">{item.shortcut}</kbd>
										)}
										{i === active && <CornerDownLeft className="size-3.5" aria-hidden="true" />}
									</div>
								</div>
							);
						})}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
