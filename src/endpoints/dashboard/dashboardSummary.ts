import { OpenAPIRoute } from "chanfana";
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { clients, tenderStatusEnum, tenders } from "../../db/schema";
import { hoursFromNow } from "../../lib/date";
import type { AppContext } from "../../types";

/**
 * Extra feature requested by the assignment: "Simple dashboard of tenders
 * due soon (active tenders with a nearby deadline)".
 */
export class DashboardSummary extends OpenAPIRoute {
	schema = {
		tags: ["Dashboard"],
		summary: "Tender counts by status + active tenders with a nearby deadline",
		request: {
			query: z.object({
				withinHours: z.coerce
					.number()
					.positive()
					.default(72)
					.describe("Window (in hours) to consider a deadline 'upcoming'"),
			}),
		},
		responses: {
			"200": {
				description: "Returns counts by status and the list of upcoming tenders",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							counts: z.record(z.enum(tenderStatusEnum), z.number()),
							total: z.number(),
							upcoming: z.any(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const db = getDb(c.env);

		const countRows = await db
			.select({ status: tenders.status, count: sql<string>`count(*)` })
			.from(tenders)
			.groupBy(tenders.status);

		const counts = Object.fromEntries(tenderStatusEnum.map((s) => [s, 0])) as Record<
			(typeof tenderStatusEnum)[number],
			number
		>;
		let total = 0;
		for (const row of countRows) {
			const n = Number(row.count);
			counts[row.status as (typeof tenderStatusEnum)[number]] = n;
			total += n;
		}

		const cutoff = hoursFromNow(data.query.withinHours);
		const upcoming = await db
			.select({
				id: tenders.id,
				title: tenders.title,
				deadline: tenders.deadline,
				maxBudget: tenders.maxBudget,
				clientName: clients.name,
			})
			.from(tenders)
			.innerJoin(clients, eq(tenders.clientId, clients.id))
			.where(
				and(eq(tenders.status, "active"), gt(tenders.deadline, new Date()), lte(tenders.deadline, cutoff)),
			)
			.orderBy(asc(tenders.deadline));

		return c.json({ success: true, counts, total, upcoming });
	}
}
