import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { tenderProducts, tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { toCents } from "./money";

export async function getTenderTotal(db: Database, tenderId: string) {
	const [row] = await db
		.select({
			total: sql<string>`coalesce(sum(${tenderProducts.subtotal}), 0)`,
		})
		.from(tenderProducts)
		.where(eq(tenderProducts.tenderId, tenderId));

	return Number(row?.total ?? 0);
}

export async function assertWithinBudget(
	db: Database,
	tenderId: string,
	maxBudget: number,
	newSubtotal: number,
) {
	const currentTotal = await getTenderTotal(db, tenderId);
	// Compare in whole cents: 0.10 + 0.20 > 0.30 in binary floating point (BR-06).
	if (toCents(currentTotal) + toCents(newSubtotal) > toCents(maxBudget)) {
		throw new AppError("TENDER_BUDGET_EXCEEDED", "The tender total exceeds the maximum budget.");
	}
}

export async function assertHasProposal(db: Database, tenderId: string) {
	const [tender] = await db
		.select({ proposalKey: tenders.proposalKey })
		.from(tenders)
		.where(eq(tenders.id, tenderId));

	if (!tender?.proposalKey) {
		throw new AppError(
			"BUSINESS_RULE_VIOLATION",
			"Tender cannot be sent without an uploaded proposal document.",
		);
	}

	return tender.proposalKey;
}
