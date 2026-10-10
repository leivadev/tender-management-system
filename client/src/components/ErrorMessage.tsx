import { ApiError, mapErrorToMessage } from "../api/errors";

export function ErrorMessage({ error }: { error: unknown }) {
	if (!error) return null;
	const message = error instanceof ApiError ? mapErrorToMessage(error) : "An unexpected error occurred.";
	return (
		<p
			role="alert"
			className="rounded-ctl border border-[color:var(--tone-negative-fg)]/20 bg-[color:var(--tone-negative-bg)] px-3 py-2 text-[13px] text-[color:var(--tone-negative-fg)]"
		>
			{message}
		</p>
	);
}
