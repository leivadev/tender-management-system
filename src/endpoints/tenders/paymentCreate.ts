import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { getDb } from "../../db/client";
import { registerPayment } from "../../domain/tenders/payments";
import type { AppContext } from "../../types";

const PaymentInput = z.object({
	amount: z.coerce.number().positive(),
	reference: z.string().optional(),
	notes: z.string().optional(),
});

export class PaymentCreate extends OpenAPIRoute {
	schema = {
		tags: ["Tenders"],
		summary: "Register a payment against a tender (only while for_collection)",
		request: {
			params: z.object({ id: z.uuid() }),
			body: { content: { "application/json": { schema: PaymentInput } } },
		},
		responses: {
			"201": {
				description: "Payment registered",
				content: {
					"application/json": {
						schema: z.object({ success: z.boolean(), payment: z.any(), pendingBalance: z.number() }),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);
		const user = c.var.user;

		const { payment, pendingBalance } = await registerPayment(db, data.params.id, data.body.amount, user.id, {
			reference: data.body.reference,
			notes: data.body.notes,
		});

		return c.json({ success: true, payment, pendingBalance }, 201);
	}
}
