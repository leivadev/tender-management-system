import {
	AlertTriangle,
	ArrowRightLeft,
	CircleDollarSign,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { DashboardMetrics } from "../api/types";
import { Badge } from "../components/Badge";
import { Card, CardHeader } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { PageHeader } from "../components/PageHeader";
import { Skeleton } from "../components/Skeleton";
import { useDashboardMetrics, useDashboardSummary } from "../hooks/useDashboard";
import { cn } from "../lib/cn";
import { formatCompactCurrency, formatCurrency, formatRelative } from "../lib/format";
import { STATUS_LABELS, STATUS_TONES } from "../lib/statusLabels";

const URGENT_WITHIN_MS = 24 * 60 * 60 * 1000;
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

const axisTick = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltipStyle = { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 };

function Kpi({
	label,
	icon,
	value,
	badge,
	note,
}: {
	label: string;
	icon: ReactNode;
	value: string;
	badge?: ReactNode;
	note: string;
}) {
	return (
		<Card className="p-4">
			<div className="flex items-center justify-between text-muted-foreground">
				<span className="text-[13px] font-medium">{label}</span>
				{icon}
			</div>
			<p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
			<div className="mt-2 flex items-center gap-2 text-xs">
				{badge}
				<span className="truncate text-muted-foreground">{note}</span>
			</div>
		</Card>
	);
}

function KpiRow({ kpis }: { kpis: DashboardMetrics["kpis"] }) {
	const { openPipeline, wonThisMonth, outstanding, overdue } = kpis;
	const delta =
		wonThisMonth.previousValue > 0
			? (wonThisMonth.value - wonThisMonth.previousValue) / wonThisMonth.previousValue
			: null;
	const up = (delta ?? 0) >= 0;

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<Kpi
				label="Open pipeline"
				icon={<CircleDollarSign className="size-4" />}
				value={formatCompactCurrency(openPipeline.value)}
				note={`${openPipeline.count} active ${openPipeline.count === 1 ? "tender" : "tenders"}`}
			/>
			<Kpi
				label="Won this month"
				icon={<TrendingUp className="size-4" />}
				value={formatCompactCurrency(wonThisMonth.value)}
				badge={
					delta !== null && (
						<Badge tone={up ? "positive" : "negative"}>
							{up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
							{`${up ? "+" : ""}${(delta * 100).toFixed(1)}%`}
						</Badge>
					)
				}
				note={`vs. ${formatCompactCurrency(wonThisMonth.previousValue)} last month`}
			/>
			<Kpi
				label="Outstanding"
				icon={<Wallet className="size-4" />}
				value={formatCompactCurrency(outstanding.value)}
				note={`${outstanding.count} ${outstanding.count === 1 ? "invoice" : "invoices"} awaiting payment`}
			/>
			<Kpi
				label="Overdue"
				icon={<AlertTriangle className="size-4" />}
				value={String(overdue.count)}
				badge={
					overdue.count > 0 && <Badge tone="negative">{formatCompactCurrency(overdue.value)} at risk</Badge>
				}
				note="Past 30 days"
			/>
		</div>
	);
}

function Charts({ metrics }: { metrics: DashboardMetrics }) {
	const navigate = useNavigate();
	const monthly = metrics.monthly.map((m) => ({
		...m,
		label: monthLabel.format(new Date(`${m.month}-01T00:00:00Z`)),
	}));
	const pipeline = metrics.pipeline.map((p) => ({ ...p, name: STATUS_LABELS[p.status] }));

	return (
		<div className="grid gap-4 lg:grid-cols-5">
			<Card className="lg:col-span-3">
				<CardHeader
					title="Won vs. collected"
					action={<span className="text-xs text-muted-foreground">Last 6 months</span>}
				/>
				<div className="h-64 px-2 pt-4 pb-2">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={monthly} margin={{ left: 4, right: 12, top: 4 }}>
							<CartesianGrid vertical={false} stroke="var(--border)" />
							<XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
							<YAxis
								tickLine={false}
								axisLine={false}
								tick={axisTick}
								width={52}
								tickFormatter={(v: number) => formatCompactCurrency(v)}
							/>
							<Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
							<Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
							<Area
								isAnimationActive={false}
								dataKey="won"
								name="Won"
								stroke="var(--chart-1)"
								fill="var(--chart-1)"
								fillOpacity={0.12}
								strokeWidth={2}
							/>
							<Area
								isAnimationActive={false}
								dataKey="collected"
								name="Collected"
								stroke="var(--chart-2)"
								fill="var(--chart-2)"
								fillOpacity={0.12}
								strokeWidth={2}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</Card>

			<Card className="lg:col-span-2">
				<CardHeader
					title="Pipeline by status"
					action={<span className="text-xs text-muted-foreground">Tenders</span>}
				/>
				<div className="h-64 px-2 pt-4 pb-2">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={pipeline} layout="vertical" margin={{ left: 8, right: 16 }}>
							<XAxis type="number" hide />
							<YAxis
								type="category"
								dataKey="name"
								tickLine={false}
								axisLine={false}
								width={96}
								tick={axisTick}
							/>
							<Tooltip
								cursor={{ fill: "var(--muted)" }}
								contentStyle={tooltipStyle}
								formatter={(v) => [v, "Tenders"]}
							/>
							<Bar
								isAnimationActive={false}
								dataKey="count"
								radius={[0, 4, 4, 0]}
								barSize={14}
								cursor="pointer"
								onClick={(d) => navigate(`/tenders?status=${(d as unknown as { status: string }).status}`)}
							>
								{pipeline.map((p) => (
									<Cell key={p.status} fill={`var(--tone-${STATUS_TONES[p.status]}-fg)`} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</Card>
		</div>
	);
}

function DueSoon() {
	const { data, isLoading, error } = useDashboardSummary(72);

	return (
		<Card className="overflow-hidden lg:col-span-3">
			<CardHeader
				title="Due in the next 72 hours"
				action={
					<Link to="/tenders?status=active" className="text-xs font-medium text-primary hover:underline">
						View all
					</Link>
				}
			/>
			{error ? (
				<div className="p-4">
					<ErrorMessage error={error} />
				</div>
			) : isLoading || !data ? (
				<div className="space-y-3 p-4">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-2/3" />
				</div>
			) : data.upcoming.length === 0 ? (
				<p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
					Nothing due in the next 72 hours.
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full min-w-max text-left text-[13px]">
						<thead className="bg-muted/50 text-xs text-muted-foreground">
							<tr>
								<th scope="col" className="h-9 px-4 font-medium">
									Tender
								</th>
								<th scope="col" className="h-9 px-4 text-right font-medium">
									Budget
								</th>
								<th scope="col" className="h-9 px-4 text-right font-medium">
									Due
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{data.upcoming.map((t) => {
								const urgent = new Date(t.deadline).getTime() - Date.now() < URGENT_WITHIN_MS;
								return (
									<tr key={t.id} className="h-12 hover:bg-muted/40">
										<td className="px-4">
											<Link to={`/tenders/${t.id}`} className="font-medium hover:text-primary">
												{t.title}
											</Link>
											<p className="text-xs text-muted-foreground">{t.clientName}</p>
										</td>
										<td className="px-4 text-right font-mono tabular-nums">{formatCurrency(t.maxBudget)}</td>
										<td className="px-4 text-right">
											<span
												className={cn(
													urgent
														? "font-medium text-[color:var(--tone-negative-fg)]"
														: "text-muted-foreground",
												)}
											>
												{formatRelative(t.deadline)}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

function Activity({ items }: { items: DashboardMetrics["activity"] }) {
	return (
		<Card className="lg:col-span-2">
			<CardHeader title="Recent activity" />
			{items.length === 0 ? (
				<EmptyState icon={ArrowRightLeft} title="No activity yet" />
			) : (
				<ul className="divide-y divide-border">
					{items.map((a) => (
						<li key={a.id} className="flex gap-3 px-4 py-2.5">
							<div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
								{a.kind === "payment" ? (
									<Wallet className="size-3.5" />
								) : (
									<ArrowRightLeft className="size-3.5" />
								)}
							</div>
							<p className="min-w-0 flex-1 text-[13px] leading-snug">
								<Link to={`/tenders/${a.tenderId}`} className="font-medium hover:text-primary">
									{a.title}
								</Link>{" "}
								<span className="text-muted-foreground">
									{a.kind === "payment" && a.amount !== null
										? `received ${formatCurrency(a.amount)}`
										: a.fromStatus && a.toStatus
											? `${STATUS_LABELS[a.fromStatus]} → ${STATUS_LABELS[a.toStatus]}`
											: a.toStatus
												? `created as ${STATUS_LABELS[a.toStatus]}`
												: ""}
								</span>
							</p>
							<span className="shrink-0 text-xs text-muted-foreground">{formatRelative(a.at)}</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-5">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{[0, 1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-28" />
				))}
			</div>
			<div className="grid gap-4 lg:grid-cols-5">
				<Skeleton className="h-72 lg:col-span-3" />
				<Skeleton className="h-72 lg:col-span-2" />
			</div>
		</div>
	);
}

export function DashboardPage() {
	const { data, isLoading, error } = useDashboardMetrics();

	return (
		<div className="space-y-5">
			<PageHeader title="Dashboard" description="Pipeline health and collections across all clients." />
			{error ? (
				<ErrorMessage error={error} />
			) : isLoading || !data ? (
				<DashboardSkeleton />
			) : (
				<>
					<KpiRow kpis={data.kpis} />
					<Charts metrics={data} />
					<div className="grid gap-4 lg:grid-cols-5">
						<DueSoon />
						<Activity items={data.activity} />
					</div>
				</>
			)}
		</div>
	);
}
