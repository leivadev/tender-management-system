import { OpenAPIRoute } from "chanfana";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { tenderStatusEnum } from "../../db/schema";
import type { AppContext } from "../../types";

const MONTHS_IN_SERIES = 6;
const ACTIVITY_LIMIT = 8;
const OVERDUE_AFTER_DAYS = 30;

type Status = (typeof tenderStatusEnum)[number];

/**
 * Read-only aggregates for the dashboard. Definitions:
 * - tender value = sum of its product line subtotals
 * - won = tender entered `finalized` (month taken from the status history)
 * - collected = payments by `paid_at`
 * - overdue = `for_collection` tenders invoiced more than OVERDUE_AFTER_DAYS days ago
 *   (the tender deadline is the bid deadline, so it says nothing about payment)
 * - the pipeline by status leaves out archived tenders; the series and activity are history and keep them
 * Months are bucketed in UTC.
 */
export class DashboardMetrics extends OpenAPIRoute {
	schema = {
		tags: ["Dashboard"],
		summary: "KPIs, 6-month won/collected series, pipeline by status and recent activity",
		responses: {
			"200": {
				description: "Returns the aggregated dashboard metrics",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							kpis: z.unknown(),
							monthly: z.unknown(),
							pipeline: z.unknown(),
							activity: z.unknown(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const db = getDb(c.env);

		// Tender value helper, reused by every query below.
		const lineTotals = sql`(select tender_id, sum(subtotal) as total from tender_products group by tender_id)`;

		const overdueCutoff = sql`now() - interval '${sql.raw(String(OVERDUE_AFTER_DAYS))} days'`;

		const [kpiRows, pipelineRows, monthlyRows, activityRows] = await Promise.all([
			db.execute(sql`
				select
					coalesce(sum(lt.total) filter (where t.status = 'active'), 0) as pipeline_value,
					count(*) filter (where t.status = 'active') as pipeline_count,
					count(*) filter (where t.status = 'for_collection') as outstanding_count,
					coalesce(sum(coalesce(t.invoice_amount, 0) - coalesce(p.paid, 0))
						filter (where t.status = 'for_collection'), 0) as outstanding_value,
					count(*) filter (where t.status = 'for_collection' and inv.invoiced_at < ${overdueCutoff}) as overdue_count,
					coalesce(sum(coalesce(t.invoice_amount, 0) - coalesce(p.paid, 0))
						filter (where t.status = 'for_collection' and inv.invoiced_at < ${overdueCutoff}), 0) as overdue_value
				from tenders t
				left join ${lineTotals} lt on lt.tender_id = t.id
				left join (select tender_id, sum(amount) as paid from payments group by tender_id) p
					on p.tender_id = t.id
				left join (
					select tender_id, max(changed_at) as invoiced_at
					from tender_status_history
					where to_status = 'for_collection'
					group by tender_id
				) inv on inv.tender_id = t.id
			`),
			db.execute(sql`
				select t.status, count(*) as count, coalesce(sum(lt.total), 0) as value
				from tenders t
				left join ${lineTotals} lt on lt.tender_id = t.id
				where t.archived_at is null
				group by t.status
			`),
			db.execute(sql`
				with months as (
					select generate_series(
						date_trunc('month', now() at time zone 'UTC') - interval '${sql.raw(String(MONTHS_IN_SERIES - 1))} months',
						date_trunc('month', now() at time zone 'UTC'),
						interval '1 month'
					) as month
				),
				won as (
					select date_trunc('month', h.changed_at at time zone 'UTC') as month,
						sum(lt.total) as value
					from tender_status_history h
					join ${lineTotals} lt on lt.tender_id = h.tender_id
					where h.to_status = 'finalized'
					group by 1
				),
				collected as (
					select date_trunc('month', paid_at at time zone 'UTC') as month, sum(amount) as value
					from payments
					group by 1
				)
				select to_char(m.month, 'YYYY-MM') as month,
					coalesce(w.value, 0) as won,
					coalesce(c.value, 0) as collected
				from months m
				left join won w on w.month = m.month
				left join collected c on c.month = m.month
				order by m.month
			`),
			db.execute(sql`
				select * from (
					select h.id::text as id, 'status' as kind, h.tender_id, t.title,
						h.from_status, h.to_status, null::numeric as amount, h.changed_at as at
					from tender_status_history h
					join tenders t on t.id = h.tender_id
					union all
					select p.id::text, 'payment', p.tender_id, t.title, null, null, p.amount, p.paid_at
					from payments p
					join tenders t on t.id = p.tender_id
				) events
				order by at desc
				limit ${ACTIVITY_LIMIT}
			`),
		]);

		const k = kpiRows[0] as Record<string, string>;

		const pipelineByStatus = new Map(pipelineRows.map((r) => [r.status as Status, r]));
		const pipeline = tenderStatusEnum.map((status) => ({
			status,
			count: Number(pipelineByStatus.get(status)?.count ?? 0),
			value: Number(pipelineByStatus.get(status)?.value ?? 0),
		}));

		const monthly = monthlyRows.map((r) => ({
			month: String(r.month),
			won: Number(r.won),
			collected: Number(r.collected),
		}));
		const current = monthly.at(-1);
		const previous = monthly.at(-2);

		const activity = activityRows.map((r) => ({
			id: String(r.id),
			kind: r.kind as "status" | "payment",
			tenderId: String(r.tender_id),
			title: String(r.title),
			fromStatus: (r.from_status as Status | null) ?? null,
			toStatus: (r.to_status as Status | null) ?? null,
			amount: r.amount === null ? null : Number(r.amount),
			at: new Date(r.at as string).toISOString(),
		}));

		return c.json({
			success: true,
			kpis: {
				openPipeline: { value: Number(k.pipeline_value), count: Number(k.pipeline_count) },
				wonThisMonth: { value: current?.won ?? 0, previousValue: previous?.won ?? 0 },
				outstanding: { value: Number(k.outstanding_value), count: Number(k.outstanding_count) },
				overdue: { count: Number(k.overdue_count), value: Number(k.overdue_value) },
			},
			monthly,
			pipeline,
			activity,
		});
	}
}
