// Single source of truth for input limits: used by the Zod schemas (src/lib/validation.ts)
// and by the CHECK constraints (src/db/schema.ts).

// DAT-12 maximum text lengths.
export const MAX_LENGTH = {
	tenderTitle: 200,
	tenderDescription: 5000,
	contactName: 200,
	companyName: 200,
	productName: 200,
	productDescription: 5000,
	paymentReference: 100,
	paymentNote: 500,
	email: 254,
} as const;

// DAT-13: consistent with numeric(12,2).
export const MONEY_MIN = 0.01;
export const MONEY_MAX = 9_999_999_999.99;

// quantity is a Postgres `integer`.
export const QUANTITY_MAX = 2_147_483_647;
