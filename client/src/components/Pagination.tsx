import type { Page } from "../api/types";
import { Button } from "./Button";

interface PaginationProps {
	meta: Pick<Page<unknown>, "page" | "pageSize" | "total">;
	onChange: (page: number) => void;
}

export function Pagination({ meta, onChange }: PaginationProps) {
	const lastPage = Math.max(1, Math.ceil(meta.total / meta.pageSize));
	// Past-the-end pages (stale bookmark) keep the controls so the user can step back.
	if (lastPage === 1 && meta.page === 1) return null;

	return (
		<div className="flex items-center justify-between text-sm text-gray-600">
			<span>
				Page {meta.page} of {lastPage} · {meta.total} total
			</span>
			<div className="flex gap-2">
				<Button variant="secondary" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>
					Previous
				</Button>
				<Button variant="secondary" disabled={meta.page >= lastPage} onClick={() => onChange(meta.page + 1)}>
					Next
				</Button>
			</div>
		</div>
	);
}
