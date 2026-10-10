import { z } from "zod";
import { MAX_LENGTH, MONEY_MAX, MONEY_MIN, QUANTITY_MAX } from "./limits";

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

// BR-02: a deadline must be ahead of now, checked again when sending (BR-15).
export const futureDeadline = () =>
	z.iso.datetime().refine((value) => new Date(value).getTime() > Date.now(), {
		message: "Must be in the future.",
	});
