import { useSearchParams } from "react-router-dom";

import type { ArchivedFilter } from "../api/types";

/** Search text, page and (admin) archived filter of a simple list, kept in the URL so views are shareable. */
export function useListParams() {
	const [searchParams, setSearchParams] = useSearchParams();
	const q = searchParams.get("q") ?? "";
	const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);

	const rawArchived = searchParams.get("archived");
	const archived: ArchivedFilter | undefined =
		rawArchived === "only" || rawArchived === "include" ? rawArchived : undefined;

	function write(next: { q: string; page: number; archived?: ArchivedFilter | undefined }) {
		const params = new URLSearchParams();
		if (next.q) params.set("q", next.q);
		if (next.page > 1) params.set("page", String(next.page));
		if (next.archived) params.set("archived", next.archived);
		setSearchParams(params);
	}

	return {
		q,
		page,
		archived,
		setQ: (value: string) => write({ q: value, page: 1, archived }),
		setPage: (value: number) => write({ q, page: value, archived }),
		setArchived: (value: ArchivedFilter | undefined) => write({ q, page: 1, archived: value }),
		clear: () => setSearchParams({}),
	};
}
