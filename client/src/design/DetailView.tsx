import { Calendar, Check, Download, Ellipsis, Lock, Receipt } from "lucide-react";
import { STATUS_LABELS } from "../lib/statusLabels";
import { DETAIL as D } from "./mock";
import { Badge, Btn, Card, CardHeader, StatusPill, type Tone, usd } from "./ui";

export function DetailView() {
	const currentIdx = D.steps.findIndex((s) => s.status === D.status);
	const total = D.lines.reduce((s, l) => s + l.qty * l.unit, 0);
	const balance = D.invoiced - D.paid;
	const pct = Math.round((D.paid / D.invoiced) * 100);

	return (
		<div className="space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-xl font-semibold tracking-tight">{D.title}</h1>
						<StatusPill status={D.status} />
					</div>
					<p className="mt-1 text-muted-foreground">
						<span className="font-data text-xs">{D.id}</span> · {D.client} · Owner {D.owner}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Btn icon={<Download className="size-3.5" />}>Proposal</Btn>
					<span title="Only admins can record payments">
						<Btn variant="primary" icon={<Lock className="size-3.5" />}>
							Record payment
						</Btn>
					</span>
					<Btn variant="ghost" icon={<Ellipsis className="size-4" />}>
						{""}
					</Btn>
				</div>
			</div>

			<Card className="p-4">
				<ol className="flex items-start">
					{D.steps.map((s, i) => {
						const done = i < currentIdx;
						const current = i === currentIdx;
						return (
							<li key={s.status} className="flex flex-1 items-start last:flex-none">
								<div className="flex flex-col items-center gap-1.5">
									<div
										className={`grid size-6 place-items-center rounded-full border text-xs font-semibold ${
											done
												? "border-primary bg-primary text-primary-foreground"
												: current
													? "border-primary bg-primary-soft text-primary ring-4 ring-primary/15"
													: "border-border bg-card text-muted-foreground"
										}`}
										aria-current={current ? "step" : undefined}
									>
										{done ? <Check className="size-3.5" /> : i + 1}
									</div>
									<p className={`text-xs ${current ? "font-semibold" : "text-muted-foreground"}`}>
										{STATUS_LABELS[s.status]}
									</p>
									<p className="font-data text-[11px] text-muted-foreground">{s.date ?? "—"}</p>
								</div>
								{i < D.steps.length - 1 && (
									<div className={`mt-3 h-px flex-1 ${i < currentIdx ? "bg-primary" : "bg-border"}`} />
								)}
							</li>
						);
					})}
				</ol>
			</Card>

			<div className="grid grid-cols-3 gap-4">
				<div className="col-span-2 space-y-4">
					<Card className="overflow-hidden">
						<CardHeader
							title="Products"
							action={<span className="text-xs text-muted-foreground">{D.lines.length} lines · locked</span>}
						/>
						<table className="w-full text-left">
							<thead>
								<tr className="text-xs text-muted-foreground">
									<th className="px-4 py-2 font-medium">Item</th>
									<th className="px-2 py-2 text-right font-medium">Qty</th>
									<th className="px-2 py-2 text-right font-medium">Unit price</th>
									<th className="px-4 py-2 text-right font-medium">Total</th>
								</tr>
							</thead>
							<tbody>
								{D.lines.map((l) => (
									<tr key={l.name} className="border-t border-border" style={{ height: "var(--row-h)" }}>
										<td className="px-4 font-medium">{l.name}</td>
										<td className="px-2 text-right font-data tabular-nums">{l.qty}</td>
										<td className="px-2 text-right font-data tabular-nums text-muted-foreground">
											{usd(l.unit)}
										</td>
										<td className="px-4 text-right font-data tabular-nums">{usd(l.qty * l.unit)}</td>
									</tr>
								))}
								<tr className="border-t border-border bg-muted/50" style={{ height: "var(--row-h)" }}>
									<td className="px-4 font-semibold" colSpan={3}>
										Total
									</td>
									<td className="px-4 text-right font-data font-semibold tabular-nums">{usd(total)}</td>
								</tr>
							</tbody>
						</table>
					</Card>

					<Card>
						<CardHeader
							title="Payments"
							action={
								<Badge tone={balance > 0 ? "warning" : "positive"}>
									{balance > 0 ? "Partially paid" : "Settled"}
								</Badge>
							}
						/>
						<div className="space-y-2 px-4 py-4">
							<div className="flex items-baseline justify-between">
								<p className="font-data text-xl font-semibold tabular-nums">
									{usd(D.paid)}{" "}
									<span className="text-sm font-normal text-muted-foreground">of {usd(D.invoiced)}</span>
								</p>
								<p className="text-muted-foreground">
									Balance{" "}
									<span className="font-data font-medium text-foreground tabular-nums">{usd(balance)}</span>
								</p>
							</div>
							<div className="h-2 overflow-hidden rounded-full bg-muted">
								<div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
							</div>
							<p className="text-xs text-muted-foreground">{pct}% collected</p>
						</div>
						<table className="w-full text-left">
							<tbody>
								{D.payments.map((p) => (
									<tr key={p.ref} className="border-t border-border" style={{ height: "var(--row-h)" }}>
										<td className="px-4 font-data text-xs text-muted-foreground">{p.date}</td>
										<td className="px-2">{p.ref}</td>
										<td className="px-4 text-right font-data tabular-nums">{usd(p.amount)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				</div>

				<div className="space-y-4">
					<Card>
						<CardHeader title="Details" />
						<dl className="divide-y divide-border">
							{[
								["Client", D.client],
								["Budget", usd(D.budget)],
								["Invoiced", usd(D.invoiced)],
								["Deadline", D.deadline],
								["Created", D.created],
							].map(([k, v]) => (
								<div key={k} className="flex items-center justify-between px-4 py-2.5">
									<dt className="text-muted-foreground">{k}</dt>
									<dd className="font-medium tabular-nums">{v}</dd>
								</div>
							))}
						</dl>
					</Card>
					<Card>
						<CardHeader title="History" action={<Receipt className="size-4 text-muted-foreground" />} />
						<ol className="px-4 py-3">
							{D.history.map((h, i) => (
								<li key={h.when} className="relative flex gap-3 pb-4 last:pb-0">
									{i < D.history.length - 1 && (
										<span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />
									)}
									<span
										className="relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-card"
										style={{ background: `var(--tone-${h.tone as Tone}-fg)` }}
									/>
									<div className="min-w-0 leading-snug">
										<p className="font-medium">{h.title}</p>
										<p className="text-xs text-muted-foreground">{h.detail}</p>
										<p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
											<Calendar className="size-3" /> {h.when} · {h.who}
										</p>
									</div>
								</li>
							))}
						</ol>
					</Card>
				</div>
			</div>
		</div>
	);
}
