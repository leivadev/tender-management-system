import { useState } from "react";
import { BudgetBar } from "../../components/BudgetBar";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { Field, FieldButtonSlot } from "../../components/Field";
import { useInvoiceTender, useUpdateTender } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { confirmAction } from "../../lib/confirm";
import { formatCurrency, formatDate } from "../../lib/format";
import { inputClass } from "../../lib/formStyles";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

function EditTenderForm({ onDone }: { onDone: () => void }) {
	const { tender } = useTenderContext();
	const updateTender = useUpdateTender(tender.id);
	const [title, setTitle] = useState(tender.title);
	const [description, setDescription] = useState(tender.description ?? "");

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		updateTender.mutate(
			{ title: title.trim(), description: description.trim() },
			{
				onSuccess: () => {
					pushToast("Tender updated.");
					onDone();
				},
			},
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-3 p-4">
			<Field label="Title" htmlFor="editTitle">
				<input
					id="editTitle"
					required
					minLength={3}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className={inputClass}
				/>
			</Field>
			<Field label="Description" htmlFor="editDescription">
				<textarea
					id="editDescription"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className={inputClass}
				/>
			</Field>
			<div className="flex gap-2">
				<Button type="submit" loading={updateTender.isPending}>
					Save
				</Button>
				<Button type="button" variant="secondary" onClick={onDone}>
					Cancel
				</Button>
			</div>
		</form>
	);
}

export function OverviewTab() {
	const { tender } = useTenderContext();
	const invoiceTender = useInvoiceTender(tender.id);
	const [invoiceAmount, setInvoiceAmount] = useState("");
	const [isEditing, setIsEditing] = useState(false);

	const usedBudget = tender.products.reduce((sum, p) => sum + Number(p.subtotal), 0);
	const { canWrite, isAdmin } = useAuth();
	const canInvoice = isAdmin && tender.status === "finalized";
	const amountToInvoice = invoiceAmount || (usedBudget > 0 ? usedBudget.toFixed(2) : "");

	async function handleInvoice(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		const amount = Number(amountToInvoice);
		const ok = await confirmAction({
			title: `Invoice ${formatCurrency(amount)}?`,
			description: "The tender moves to For collection and payments can be recorded.",
			confirmLabel: "Invoice",
		});
		if (!ok) return;
		invoiceTender.mutate({ invoiceAmount: amount }, { onSuccess: () => pushToast("Invoice recorded.") });
	}

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<div className="space-y-4 lg:col-span-2">
				<Card>
					<CardHeader
						title="Description"
						action={
							canWrite && !isEditing ? (
								<Button variant="link" onClick={() => setIsEditing(true)}>
									Edit
								</Button>
							) : undefined
						}
					/>
					{isEditing ? (
						<EditTenderForm onDone={() => setIsEditing(false)} />
					) : (
						<p className="px-4 py-3 text-[13px] leading-relaxed">
							{tender.description || <span className="text-muted-foreground">No description.</span>}
						</p>
					)}
				</Card>

				<Card className="space-y-3 p-4">
					<BudgetBar used={usedBudget} max={Number(tender.maxBudget)} label="Budget used" />
					{tender.status === "for_collection" && (
						<p className="text-[13px] text-muted-foreground">
							Record payments in the <span className="font-medium text-foreground">Payments</span> tab.
						</p>
					)}
					{(tender.status === "collected" || tender.status === "lost") && (
						<p className="text-[13px] text-muted-foreground">This tender is in a final status.</p>
					)}
				</Card>

				{canInvoice && (
					<Card>
						<CardHeader title="Invoice" />
						<form className="flex flex-wrap items-end gap-3 p-4" onSubmit={handleInvoice}>
							<Field
								label="Amount to invoice"
								htmlFor="invoiceAmount"
								hint="Prefilled from the product total"
							>
								<input
									id="invoiceAmount"
									type="number"
									min="0.01"
									step="0.01"
									required
									value={amountToInvoice}
									onChange={(e) => setInvoiceAmount(e.target.value)}
									className={inputClass}
								/>
							</Field>
							<FieldButtonSlot>
								<Button variant="warning" type="submit" loading={invoiceTender.isPending}>
									Invoice
								</Button>
							</FieldButtonSlot>
						</form>
					</Card>
				)}
			</div>

			<Card className="self-start">
				<CardHeader title="Details" />
				<dl className="divide-y divide-border text-[13px]">
					{[
						["Budget", formatCurrency(tender.maxBudget)],
						["Deadline", formatDate(tender.deadline)],
						["Invoiced", tender.invoiceAmount ? formatCurrency(tender.invoiceAmount) : "—"],
						["Created", formatDate(tender.createdAt)],
						["Updated", formatDate(tender.updatedAt)],
					].map(([label, value]) => (
						<div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="text-right font-medium tabular-nums">{value}</dd>
						</div>
					))}
				</dl>
			</Card>
		</div>
	);
}
