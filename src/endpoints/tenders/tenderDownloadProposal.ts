import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { getProposalObject } from "../../services/storage";
import type { AppContext } from "../../types";

/**
 * Serves the real, browsable URL required by the assignment: the R2 bucket
 * stays private, and this authenticated endpoint streams the object.
 */
export class TenderDownloadProposal extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Download the proposal document for a tender",
		request: {
			params: z.object({ id: z.uuid() }),
		},
		responses: {
			"200": { description: "Returns the PDF file" },
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const tenderId = data.params.id;

		const [tender] = await db.select().from(tenders).where(eq(tenders.id, tenderId));
		if (!tender?.proposalKey) {
			throw new AppError("NOT_FOUND", "No proposal document uploaded for this tender.");
		}

		const object = await getProposalObject(c.env, tender.proposalKey);

		return new Response(object.body, {
			headers: {
				"Content-Type": tender.proposalContentType ?? "application/pdf",
				"Content-Disposition": `inline; filename="${tender.proposalFilename ?? "proposal.pdf"}"`,
			},
		});
	}
}
