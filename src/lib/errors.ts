export type ErrorCode =
	| "VALIDATION_ERROR"
	| "UNAUTHENTICATED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "CONFLICT"
	| "BUSINESS_RULE_VIOLATION"
	| "TENDER_BUDGET_EXCEEDED"
	| "INVALID_TENDER_TRANSITION"
	| "RATE_LIMITED"
	| "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
	VALIDATION_ERROR: 400,
	UNAUTHENTICATED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	BUSINESS_RULE_VIOLATION: 422,
	TENDER_BUDGET_EXCEEDED: 422,
	INVALID_TENDER_TRANSITION: 422,
	RATE_LIMITED: 429,
	INTERNAL_ERROR: 500,
};

export class AppError extends Error {
	code: ErrorCode;
	status: number;

	constructor(code: ErrorCode, message: string) {
		super(message);
		this.code = code;
		this.status = STATUS_BY_CODE[code];
	}
}

// Postgres unique_violation. Drizzle wraps driver errors, keeping the original as `cause`.
export function isUniqueViolation(err: unknown): boolean {
	const e = err as { code?: string; cause?: { code?: string } } | null;
	return e?.code === "23505" || e?.cause?.code === "23505";
}

export function errorBody(error: AppError) {
	return {
		error: {
			code: error.code,
			message: error.message,
		},
	};
}
