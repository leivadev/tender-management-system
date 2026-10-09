import {
	AlertTriangle,
	ArrowUpRight,
	CircleDollarSign,
	TrendingDown,
	TrendingUp,
	Wallet,
} from "lucide-react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { STATUS_LABELS } from "../lib/statusLabels";
import { ACTIVITY, DUE_SOON, KPIS, MONTHLY, PIPELINE } from "./mock";
import { Badge, Card, CardHeader, StatusPill, usd } from "./ui";

const KPI_ICONS = {
	pipeline: CircleDollarSign,
	won: TrendingUp,
	outstanding: Wallet,
	overdue: AlertTriangle,
} as const;

export function DashboardView() {
	return (
		<div className="space-y-5">
			<div>
				<h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">Pipeline health and collections across all clients.</p>
			</div>

			<div className="grid grid-cols-4 gap-4">
				{KPIS.map((k) => {
					const Icon = KPI_ICONS[k.icon];
					return (
						<Card key={k.label} className="p-4">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-[13px] font-medium">{k.label}</span>
								<Icon className="size-4" />
							</div>
							<p className="mt-2 font-data text-2xl font-semibold tracking-tight tabular-nums">
								{k.icon === "overdue" ? k.value : usd(k.value, true)}
							</p>
							<div className="mt-2 flex items-center gap-2 text-xs">
								<Badge tone={k.tone}>
									{k.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
									{k.delta}
								</Badge>
								<span className="truncate text-muted-foreground">{k.note}</span>
							</div>
						</Card>
					);
				})}
			</div>

			<div className="grid grid-cols-5 gap-4">
				<Card className="col-span-3">
					<CardHeader
						title="Won vs. collected"
						action={<span className="text-xs text-muted-foreground">Last 6 months · $k</span>}
					/>
					<div className="h-60 px-2 pt-4 pb-2">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={MONTHLY} margin={{ left: -10, right: 12, top: 4 }}>
								<CartesianGrid vertical={false} stroke="var(--border)" />
								<XAxis
									dataKey="month"
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
								/>
								<Tooltip
									contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
								/>
								<Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
								<Area
									isAnimationActive={false}
									dataKey="won"
									stroke="var(--chart-1)"
									fill="var(--chart-1)"
									fillOpacity={0.12}
									strokeWidth={2}
									name="Won"
								/>
								<Area
									isAnimationActive={false}
									dataKey="collected"
									stroke="var(--chart-2)"
									fill="var(--chart-2)"
									fillOpacity={0.12}
									strokeWidth={2}
									name="Collected"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</Card>
				<Card className="col-span-2">
					<CardHeader
						title="Pipeline by status"
						action={<span className="text-xs text-muted-foreground">Tenders</span>}
					/>
					<div className="h-60 px-2 pt-4 pb-2">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart
								data={PIPELINE.map((p) => ({ name: STATUS_LABELS[p.status], count: p.count }))}
								layout="vertical"
								margin={{ left: 20, right: 16 }}
							>
								<XAxis type="number" hide />
								<YAxis
									type="category"
									dataKey="name"
									tickLine={false}
									axisLine={false}
									width={96}
									tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
								/>
								<Tooltip
									cursor={{ fill: "var(--muted)" }}
									contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
								/>
								<Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={14} />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Card>
			</div>

			<div className="grid grid-cols-5 gap-4">
				<Card className="col-span-3 overflow-hidden">
					<CardHeader
						title="Due in the next 72 hours"
						action={
							<span className="flex items-center gap-1 text-xs font-medium text-primary">
								View all <ArrowUpRight className="size-3" />
							</span>
						}
					/>
					<table className="w-full text-left">
						<thead>
							<tr className="text-xs text-muted-foreground">
								<th className="px-4 py-2 font-medium">Tender</th>
								<th className="px-2 py-2 font-medium">Status</th>
								<th className="px-2 py-2 text-right font-medium">Budget</th>
								<th className="px-4 py-2 text-right font-medium">Due</th>
							</tr>
						</thead>
						<tbody>
							{DUE_SOON.map((t) => (
								<tr
									key={t.id}
									className="border-t border-border hover:bg-muted/60"
									style={{ height: "calc(var(--row-h) + 14px)" }}
								>
									<td className="px-4">
										<p className="truncate font-medium leading-tight">{t.title}</p>
										<p className="font-data text-[11px] text-muted-foreground">
											{t.id} · {t.client}
										</p>
									</td>
									<td className="px-2">
										<StatusPill status={t.status} />
									</td>
									<td className="px-2 text-right font-data tabular-nums">{usd(t.budget)}</td>
									<td className="px-4 text-right">
										<span
											className={
												t.urgent
													? "font-medium text-[color:var(--tone-negative-fg)]"
													: "text-muted-foreground"
											}
										>
											{t.due}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
				<Card className="col-span-2">
					<CardHeader title="Recent activity" />
					<ul className="divide-y divide-border">
						{ACTIVITY.map((a) => (
							<li key={a.target + a.when} className="flex gap-3 px-4 py-2.5">
								<div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
									{a.who[0]}
								</div>
								<p className="min-w-0 flex-1 leading-snug">
									<span className="font-medium">{a.who}</span>{" "}
									<span className="text-muted-foreground">{a.what}</span>{" "}
									<span className="font-data text-xs text-primary">{a.target}</span>
								</p>
								<span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
							</li>
						))}
					</ul>
				</Card>
			</div>
		</div>
	);
}
