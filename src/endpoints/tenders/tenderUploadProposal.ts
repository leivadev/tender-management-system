import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { withLockedTender } from "../../domain/tenders/locking";
import { assertProposalEditable } from "../../domain/tenders/rules";
import { AppError } from "../../lib/errors";
import { deleteProposalQuietly, readProposalFile, storeProposal } from "../../services/storage";
import type { AppContext } from "../../types";

export class TenderUploadProposal extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Upload the proposal document (PDF) for a tender",
		request: {
			params: z.object({ id: z.uuid() }),
			body: {
				content: {
					"multipart/form-data": {
						schema: z.object({ file: z.unknown().openapi({ type: "string", format: "binary" }) }),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Proposal uploaded",
				content: { "application/json": { schema: z.object({ success: z.boolean(), tender: z.unknown() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;
		const tenderId = data.params.id;

		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			throw new AppError("VALIDATION_ERROR", "Missing file in form data.");
		}

		const bytes = await readProposalFile(file);

		const { updated, previousKey } = await withLockedTender(db, tenderId, async (tx, tender) => {
			assertProposalEditable(tender.status);
			const uploaded = await storeProposal(c.env, tenderId, file.name, bytes);

			const [row] = await tx
				.update(tenders)
				.set({
					proposalKey: uploaded.key,
					proposalUrl: uploaded.url,
					proposalFilename: uploaded.filename,
					proposalContentType: uploaded.contentType,
					updatedAt: new Date(),
					updatedBy: user.id,
				})
				.where(eq(tenders.id, tenderId))
				.returning();
			return { updated: row, previousKey: tender.proposalKey };
		});

		// Only after the new object is stored and the row committed (FR-54).
		if (previousKey) await deleteProposalQuietly(c.env, previousKey);
		return c.json({ success: true, tender: updated });
	}
}
