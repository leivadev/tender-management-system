import { useSearchParams } from "react-router-dom";

/** Search text and page of a simple list, kept in the URL so views are shareable. */
export function useListParams() {
	const [searchParams, setSearchParams] = useSearchParams();
	const q = searchParams.get("q") ?? "";
	const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "", 10) || 1);

	function write(next: { q: string; page: number }) {
		const params = new URLSearchParams();
		if (next.q) params.set("q", next.q);
		if (next.page > 1) params.set("page", String(next.page));
		setSearchParams(params);
	}

	return {
		q,
		page,
		setQ: (value: string) => write({ q: value, page: 1 }),
		setPage: (value: number) => write({ q, page: value }),
		clear: () => setSearchParams({}),
	};
}
