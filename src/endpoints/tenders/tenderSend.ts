import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients, products, tenderProducts, tenders } from "../../db/schema";
import { reloadTender, withLockedTender } from "../../domain/tenders/locking";
import {
	assertDeadlineInFuture,
	assertHasProposal,
	isWithinReminderWindow,
} from "../../domain/tenders/rules";
import {
	assertValidTransition,
	type TenderStatus,
	transitionTender,
} from "../../domain/tenders/state-machine";
import { AppError } from "../../lib/errors";
import { sendTenderEmail } from "../../services/email";
import { getProposalObject } from "../../services/storage";
import type { AppContext } from "../../types";

export class TenderSend extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Send the tender to the client (draft -> active)",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": {
				description: "Tender sent",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.any() }) } },
			},
			"502": {
				description:
					"The email provider failed (code `EMAIL_DELIVERY_FAILED`). The tender stays a draft and the send can be retried.",
				content: {
					"application/json": {
						schema: z.object({
							error: z.object({ code: z.literal("EMAIL_DELIVERY_FAILED"), message: z.string() }),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		// The tender stays locked through the email and the transition, so lines,
		// budget and deadline cannot change between what the client is sent and
		// what gets stored (BR-09).
		const updated = await withLockedTender(db, tenderId, async (tx, tender) => {
			assertValidTransition(tender.status as TenderStatus, "active");

			const proposalKey = assertHasProposal(tender);
			assertDeadlineInFuture(tender.deadline);
			// Confirm the object really exists in R2, not just the DB reference.
			const proposalObject = await getProposalObject(c.env, proposalKey);

			const [client] = await tx.select().from(clients).where(eq(clients.id, tender.clientId));
			if (!client) {
				throw new AppError("NOT_FOUND", `Client ${tender.clientId} not found.`);
			}

			const items = await tx
				.select({
					name: products.name,
					quantity: tenderProducts.quantity,
					unitPrice: tenderProducts.unitPrice,
				})
				.from(tenderProducts)
				.innerJoin(products, eq(tenderProducts.productId, products.id))
				.where(eq(tenderProducts.tenderId, tenderId));

			await sendTenderEmail(
				c.env,
				{
					title: tender.title,
					clientEmail: client.email,
					clientName: client.name,
					maxBudget: tender.maxBudget,
					deadline: tender.deadline,
					products: items,
				},
				{
					filename: tender.proposalFilename ?? "proposal.pdf",
					content: await proposalObject.arrayBuffer(),
					contentType: tender.proposalContentType ?? "application/pdf",
				},
			);

			await transitionTender(tx, tenderId, "active", user.id);
			// With less than 48h left the client was just told the deadline; no reminder (FR-29).
			if (isWithinReminderWindow(tender.deadline)) {
				await tx.update(tenders).set({ reminderSentAt: new Date() }).where(eq(tenders.id, tenderId));
			}
			return reloadTender(tx, tenderId);
		});

		return c.json({ success: true, tender: updated });
	}
}
