import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "./Button";

const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean; adminOnly?: boolean }> = [
	{ to: "/", label: "Dashboard", end: true },
	{ to: "/tenders", label: "Tenders" },
	{ to: "/clients", label: "Clients" },
	{ to: "/products", label: "Products" },
	{ to: "/users", label: "Users", adminOnly: true },
];

const FOOTER_LINK_CLASS = "text-gray-500 underline hover:text-gray-700";

export function Layout({ children }: { children: ReactNode }) {
	const { email, logout, isAdmin } = useAuth();

	return (
		<div className="flex min-h-screen flex-col bg-gray-50">
			<header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
					<nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
						<span className="font-semibold text-gray-900">Tender Management System</span>
						{NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								end={item.end}
								className={({ isActive }) =>
									`rounded-md px-1.5 py-1 text-sm transition-colors ${
										isActive ? "font-medium text-blue-600" : "text-gray-600 hover:text-gray-900"
									}`
								}
							>
								{item.label}
							</NavLink>
						))}
					</nav>
					<div className="flex items-center gap-3 text-sm text-gray-600">
						<span className="hidden sm:inline">{email}</span>
						<Button variant="secondary" onClick={() => logout()}>
							Log out
						</Button>
					</div>
				</div>
			</header>
			<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
			<footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-gray-200 bg-white px-4 py-4 text-center text-xs text-gray-400">
				<span>
					Built by{" "}
					<a
						href="https://leivadev.com"
						target="_blank"
						rel="noopener noreferrer"
						className={FOOTER_LINK_CLASS}
					>
						leivadev
					</a>
				</span>
				<a
					href="https://github.com/leivadev/tender-management-system"
					target="_blank"
					rel="noopener noreferrer"
					className={FOOTER_LINK_CLASS}
				>
					GitHub
				</a>
				<a href="/api/docs" target="_blank" rel="noopener noreferrer" className={FOOTER_LINK_CLASS}>
					API (Swagger)
				</a>
			</footer>
		</div>
	);
}
