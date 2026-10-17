// NFR-19, NFR-20, SEC-07: logs never carry personal data or secrets. Error messages can echo
// them (driver errors quote the query parameters, provider errors quote the request), so an
// unexpected error is logged by shape (class, driver codes, stack frames), never by message.

type ErrorLike = {
	name?: unknown;
	code?: unknown;
	severity?: unknown;
	constraint_name?: unknown;
	table_name?: unknown;
	column_name?: unknown;
	stack?: unknown;
	cause?: unknown;
};

const MAX_CAUSE_DEPTH = 3;
const MAX_STACK_FRAMES = 10;

const asString = (value: unknown) => (typeof value === "string" ? value : undefined);

function describeError(err: unknown, depth = 0): Record<string, unknown> {
	if (typeof err !== "object" || err === null) return { type: typeof err };
	const e = err as ErrorLike;
	const frames = asString(e.stack)
		?.split("\n")
		.filter((line) => line.trimStart().startsWith("at "))
		.slice(0, MAX_STACK_FRAMES)
		.map((line) => line.trim());
	return {
		name: asString(e.name),
		code: asString(e.code),
		severity: asString(e.severity),
		constraint: asString(e.constraint_name),
		table: asString(e.table_name),
		column: asString(e.column_name),
		stack: frames,
		...(e.cause !== undefined && depth < MAX_CAUSE_DEPTH && { cause: describeError(e.cause, depth + 1) }),
	};
}

/** NFR-27: logs an unexpected error under a fresh correlation id and returns the id for the caller. */
export function logUnexpectedError(err: unknown, context: Record<string, string | number> = {}): string {
	const correlationId = crypto.randomUUID();
	console.error(
		JSON.stringify({ level: "error", correlation_id: correlationId, ...context, error: describeError(err) }),
	);
	return correlationId;
}
