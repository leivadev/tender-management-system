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

export class ApiError extends Error {
	code: ErrorCode;
	status: number;

	constructor(code: ErrorCode, message: string, status: number) {
		super(message);
		this.code = code;
		this.status = status;
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
	RATE_LIMITED: "Too many requests, try again in a few seconds.",
	EMAIL_DELIVERY_FAILED:
		"The email could not be delivered. The tender is still a draft; try sending it again.",
	INTERNAL_ERROR: "An unexpected error occurred.",
};

// Codes whose server message says what to fix (field, balance, budget...).
const SERVER_MESSAGE_CODES = new Set<ErrorCode>([
	"VALIDATION_ERROR",
	"BUSINESS_RULE_VIOLATION",
	"TENDER_BUDGET_EXCEEDED",
	"CONFLICT",
]);

export function mapErrorToMessage(error: ApiError): string {
	if (SERVER_MESSAGE_CODES.has(error.code) && error.message) return error.message;
	return MESSAGES[error.code] ?? error.message;
}
