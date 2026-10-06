import { OpenAPIRoute } from "chanfana";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenders } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { uploadProposal } from "../../services/storage";
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
						schema: z.object({ file: z.any().openapi({ type: "string", format: "binary" }) }),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Proposal uploaded",
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

		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			throw new AppError("VALIDATION_ERROR", "Missing file in form data.");
		}

		const uploaded = await uploadProposal(c.env, tenderId, file);

		const [updated] = await db
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

		return c.json({ success: true, tender: updated });
	}
}
