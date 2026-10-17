import { useState } from "react";
import { fieldErrors } from "../../api/errors";
import { BudgetBar } from "../../components/BudgetBar";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { Field, FieldButtonSlot } from "../../components/Field";
import {
	useCorrectTenderInvoice,
	useInvoiceTender,
	useTenderPayments,
	useUpdateTender,
} from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { confirmAction } from "../../lib/confirm";
import { toLocalInputValue } from "../../lib/datetime";
import { formatCurrency, formatDate } from "../../lib/format";
import { fieldClass } from "../../lib/formStyles";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

function EditTenderForm({ onDone, usedBudget }: { onDone: () => void; usedBudget: number }) {
	const { tender } = useTenderContext();
	const updateTender = useUpdateTender(tender.id);
	const [title, setTitle] = useState(tender.title);
	const [description, setDescription] = useState(tender.description ?? "");
	const [maxBudget, setMaxBudget] = useState(String(Number(tender.maxBudget)));
	const [initialDeadline] = useState(() => toLocalInputValue(new Date(tender.deadline)));
	const [deadline, setDeadline] = useState(initialDeadline);
	const [deadlineError, setDeadlineError] = useState<string | null>(null);
	const errs = fieldErrors(updateTender.error);
	// Budget and deadline are frozen once the tender leaves draft (BR-10).
	const isDraft = tender.status === "draft";

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();

		// Send budget and deadline only when edited: an untouched deadline must not
		// shift (the input drops seconds) nor block a title edit on an expired draft.
		const budgetChanged = isDraft && Number(maxBudget) !== Number(tender.maxBudget);
		const deadlineChanged = isDraft && deadline !== initialDeadline;
		if (deadlineChanged && new Date(deadline).getTime() <= Date.now()) {
			setDeadlineError("The deadline must be in the future.");
			return;
		}
		setDeadlineError(null);

		updateTender.mutate(
			{
				title: title.trim(),
				description: description.trim(),
				...(budgetChanged && { maxBudget: Number(maxBudget) }),
				...(deadlineChanged && { deadline: new Date(deadline).toISOString() }),
			},
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
			<Field label="Title" htmlFor="editTitle" error={errs.title}>
				<input
					id="editTitle"
					required
					minLength={3}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className={fieldClass(Boolean(errs.title))}
				/>
			</Field>
			<Field label="Description" htmlFor="editDescription" error={errs.description}>
				<textarea
					id="editDescription"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className={fieldClass(Boolean(errs.description))}
				/>
			</Field>
			{isDraft && (
				<div className="grid gap-x-4 sm:grid-cols-2">
					<Field
						label="Maximum budget"
						htmlFor="editMaxBudget"
						hint={`USD, not below the products total (${formatCurrency(usedBudget)})`}
						error={errs.maxBudget}
					>
						<input
							id="editMaxBudget"
							type="number"
							min={Math.max(0.01, usedBudget)}
							step="0.01"
							required
							value={maxBudget}
							onChange={(e) => setMaxBudget(e.target.value)}
							className={fieldClass(Boolean(errs.maxBudget))}
						/>
					</Field>
					<Field label="Deadline" htmlFor="editDeadline" error={deadlineError ?? errs.deadline}>
						<input
							id="editDeadline"
							type="datetime-local"
							min={toLocalInputValue(new Date())}
							required
							value={deadline}
							onChange={(e) => {
								setDeadline(e.target.value);
								setDeadlineError(null);
							}}
							className={fieldClass(Boolean(deadlineError ?? errs.deadline))}
						/>
					</Field>
				</div>
			)}
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
	const correctInvoice = useCorrectTenderInvoice(tender.id);
	const payments = useTenderPayments(tender.id);
	const [invoiceAmount, setInvoiceAmount] = useState("");
	const [correctedAmount, setCorrectedAmount] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const invoiceErrs = fieldErrors(invoiceTender.error);
	const correctErrs = fieldErrors(correctInvoice.error);

	const usedBudget = tender.products.reduce((sum, p) => sum + Number(p.subtotal), 0);
	const { canWrite, isAdmin } = useAuth();
	const canInvoice = isAdmin && tender.status === "finalized";
	// FR-50: only before the first payment, once the invoice exists.
	const canCorrectInvoice =
		isAdmin &&
		tender.status === "for_collection" &&
		payments.data !== undefined &&
		payments.data.length === 0;
	const amountToCorrect =
		correctedAmount || (tender.invoiceAmount ? Number(tender.invoiceAmount).toFixed(2) : "");
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

	async function handleCorrectInvoice(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		const amount = Number(amountToCorrect);
		const ok = await confirmAction({
			title: `Correct invoice to ${formatCurrency(amount)}?`,
			description: "The status does not change. This is only possible until the first payment is recorded.",
			confirmLabel: "Correct invoice",
		});
		if (!ok) return;
		correctInvoice.mutate(
			{ invoiceAmount: amount },
			{
				onSuccess: () => {
					setCorrectedAmount("");
					pushToast("Invoice corrected.");
				},
			},
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<div className="space-y-4 lg:col-span-2">
				<Card>
					<CardHeader
						title="Description"
						action={
							canWrite && !isEditing && !tender.archivedAt ? (
								<Button variant="link" onClick={() => setIsEditing(true)}>
									Edit
								</Button>
							) : undefined
						}
					/>
					{isEditing ? (
						<EditTenderForm onDone={() => setIsEditing(false)} usedBudget={usedBudget} />
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
								error={invoiceErrs.invoiceAmount}
							>
								<input
									id="invoiceAmount"
									type="number"
									min="0.01"
									step="0.01"
									required
									value={amountToInvoice}
									onChange={(e) => setInvoiceAmount(e.target.value)}
									className={fieldClass(Boolean(invoiceErrs.invoiceAmount))}
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

				{canCorrectInvoice && (
					<Card>
						<CardHeader title="Correct invoice" />
						<form className="flex flex-wrap items-end gap-3 p-4" onSubmit={handleCorrectInvoice}>
							<Field
								label="Invoiced amount"
								htmlFor="correctedInvoiceAmount"
								hint="Editable until the first payment is recorded"
								error={correctErrs.invoiceAmount}
							>
								<input
									id="correctedInvoiceAmount"
									type="number"
									min="0.01"
									step="0.01"
									required
									value={amountToCorrect}
									onChange={(e) => setCorrectedAmount(e.target.value)}
									className={fieldClass(Boolean(correctErrs.invoiceAmount))}
								/>
							</Field>
							<FieldButtonSlot>
								<Button variant="warning" type="submit" loading={correctInvoice.isPending}>
									Correct
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
