import { z } from "zod";

// DAT-12 maximum text lengths. Mirrored by CHECK constraints in src/db/schema.ts.
export const MAX_LENGTH = {
	tenderTitle: 200,
	tenderDescription: 5000,
	contactName: 200,
	companyName: 200,
	productName: 200,
	paymentReference: 100,
	paymentNote: 500,
	email: 254,
} as const;

// DAT-13: consistent with numeric(12,2).
export const MONEY_MIN = 0.01;
export const MONEY_MAX = 9_999_999_999.99;

// quantity is a Postgres `integer`.
export const QUANTITY_MAX = 2_147_483_647;

export const requiredText = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) => z.string().max(max);
export const emailAddress = () => z.email().max(MAX_LENGTH.email);

// Whole cents only: 10.555 is rejected instead of silently rounded.
export const money = () =>
	z.coerce
		.number()
		.min(MONEY_MIN)
		.max(MONEY_MAX)
		.refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
			message: "Must have at most 2 decimal places.",
		});

export const quantity = () => z.coerce.number().int().min(1).max(QUANTITY_MAX);
