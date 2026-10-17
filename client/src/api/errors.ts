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
	| "EMAIL_DELIVERY_FAILED"
	| "INTERNAL_ERROR";

export interface FieldIssue {
	field: string;
	message: string;
}

export class ApiError extends Error {
	code: ErrorCode;
	status: number;
	fields: FieldIssue[];

	constructor(code: ErrorCode, message: string, status: number, fields: FieldIssue[] = []) {
		super(message);
		this.code = code;
		this.status = status;
		this.fields = fields;
	}
}

const MESSAGES: Record<ErrorCode, string> = {
	VALIDATION_ERROR: "The data entered is not valid.",
	UNAUTHENTICATED: "Your session expired, please log in again.",
	FORBIDDEN: "You do not have permission to perform this action.",
	NOT_FOUND: "The requested resource was not found.",
	CONFLICT: "The operation conflicts with the current state.",
	BUSINESS_RULE_VIOLATION: "The operation violates a business rule.",
	TENDER_BUDGET_EXCEEDED: "The tender's maximum budget would be exceeded.",
	INVALID_TENDER_TRANSITION: "That status transition is not valid right now.",
	RATE_LIMITED: "Too many attempts, try again in a few minutes.",
	EMAIL_DELIVERY_FAILED:
		"The email could not be delivered. The tender is still a draft; try sending it again.",
	INTERNAL_ERROR: "An unexpected error occurred.",
};

/** UI-01: the server's own message is what the user sees; the table above only covers replies without one. */
export function mapErrorToMessage(error: ApiError): string {
	return error.message || MESSAGES[error.code] || MESSAGES.INTERNAL_ERROR;
}

/** UI-02: first message per failing field, keyed by the request field name. Empty for any other error. */
export function fieldErrors(error: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	if (!(error instanceof ApiError)) return out;
	for (const { field, message } of error.fields) out[field] ??= message;
	return out;
}
