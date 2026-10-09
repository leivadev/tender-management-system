import { ApiError, mapErrorToMessage } from "../api/errors";

export function ErrorMessage({ error }: { error: unknown }) {
	if (!error) return null;
	const message = error instanceof ApiError ? mapErrorToMessage(error) : "An unexpected error occurred.";
	return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}
