import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients, products, tenderProducts, tenders } from "../../db/schema";
import { assertHasProposal } from "../../domain/tenders/rules";
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
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		const [tender] = await db.select().from(tenders).where(eq(tenders.id, tenderId));
		if (!tender) {
			throw new AppError("NOT_FOUND", `Tender ${tenderId} not found.`);
		}
		assertValidTransition(tender.status as TenderStatus, "active");

		const proposalKey = await assertHasProposal(db, tenderId);
		// Confirm the object really exists in R2, not just the DB reference.
		const proposalObject = await getProposalObject(c.env, proposalKey);

		const [client] = await db.select().from(clients).where(eq(clients.id, tender.clientId));
		if (!client) {
			throw new AppError("NOT_FOUND", `Client ${tender.clientId} not found.`);
		}

		const items = await db
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

		await transitionTender(db, tenderId, "active", user.id);

		const [updated] = await db.select().from(tenders).where(eq(tenders.id, tenderId));
		return c.json({ success: true, tender: updated });
	}
}
