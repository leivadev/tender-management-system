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
	VALIDATION_ERROR: "Los datos ingresados no son válidos.",
	UNAUTHENTICATED: "Tu sesión expiró, ingresa de nuevo.",
	FORBIDDEN: "No tienes permiso para realizar esta acción.",
	NOT_FOUND: "No se encontró el recurso solicitado.",
	CONFLICT: "La operación entra en conflicto con el estado actual.",
	BUSINESS_RULE_VIOLATION: "La operación no cumple una regla de negocio.",
	TENDER_BUDGET_EXCEEDED: "El presupuesto máximo de la licitación sería superado.",
	INVALID_TENDER_TRANSITION: "Esa transición de estado no es válida en este momento.",
	RATE_LIMITED: "Demasiadas solicitudes, intenta de nuevo en unos segundos.",
	INTERNAL_ERROR: "Ocurrió un error inesperado.",
};

export function mapErrorToMessage(error: ApiError): string {
	return MESSAGES[error.code] ?? error.message;
}
