import { Wallet } from "lucide-react";
import { useState } from "react";
import { fieldErrors } from "../../api/errors";
import { BudgetBar } from "../../components/BudgetBar";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../../components/Field";
import { Table, TBody, TD, TH, THead, TR } from "../../components/Table";
import { useCreateTenderPayment, useTenderPayments } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { formatCurrency, formatDate } from "../../lib/format";
import { fieldClass } from "../../lib/formStyles";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

export function PaymentsTab() {
	const { tender } = useTenderContext();
	const paymentsQuery = useTenderPayments(tender.id);
	const createPayment = useCreateTenderPayment(tender.id);
	const [amount, setAmount] = useState("");
	const [reference, setReference] = useState("");
	const [notes, setNotes] = useState("");
	const errs = fieldErrors(createPayment.error);

	const invoiceAmount = Number(tender.invoiceAmount ?? 0);
	const paid = (paymentsQuery.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
	const pendingBalance = Math.max(0, invoiceAmount - paid);
	const { isAdmin } = useAuth();
	const canPay = isAdmin && tender.status === "for_collection";
	const willComplete = canPay && Number(amount) > 0 && Number(amount) >= pendingBalance;

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		createPayment.mutate(
			{ amount: Number(amount), reference: reference.trim() || undefined, notes: notes.trim() || undefined },
			{
				onSuccess: (res) => {
					setAmount("");
					setReference("");
					setNotes("");
					pushToast(
						res.pendingBalance <= 0 ? "Payment recorded. Tender fully collected." : "Payment recorded.",
					);
				},
			},
		);
	}

	return (
		<div className="space-y-4">
			{paymentsQuery.error && <ErrorMessage error={paymentsQuery.error} />}
			{tender.invoiceAmount && <BudgetBar used={paid} max={invoiceAmount} label="Collected" />}

			{paymentsQuery.data?.length === 0 ? (
				<EmptyState
					icon={Wallet}
					title="No payments recorded"
					description="Payments appear here once the tender is invoiced and collections start."
				/>
			) : (
				<Table>
					<THead>
						<tr>
							<TH>Date</TH>
							<TH>Reference</TH>
							<TH>Notes</TH>
							<TH numeric>Amount</TH>
						</tr>
					</THead>
					<TBody>
						{(paymentsQuery.data ?? []).map((payment) => (
							<TR key={payment.id}>
								<TD className="text-muted-foreground">{formatDate(payment.paidAt)}</TD>
								<TD>{payment.reference || "—"}</TD>
								<TD className="text-muted-foreground">{payment.notes || "—"}</TD>
								<TD numeric>{formatCurrency(payment.amount)}</TD>
							</TR>
						))}
					</TBody>
				</Table>
			)}

			{canPay ? (
				<form
					onSubmit={handleSubmit}
					className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4 shadow-card"
				>
					<Field
						label={`Amount (balance: ${formatCurrency(pendingBalance)})`}
						htmlFor="amount"
						error={errs.amount}
					>
						<input
							id="amount"
							type="number"
							min="0.01"
							max={pendingBalance || undefined}
							step="0.01"
							required
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className={`w-40 ${fieldClass(Boolean(errs.amount))}`}
						/>
					</Field>
					<Field label="Reference" htmlFor="reference" error={errs.reference}>
						<input
							id="reference"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
							className={fieldClass(Boolean(errs.reference))}
						/>
					</Field>
					<Field label="Notes" htmlFor="notes" error={errs.notes}>
						<input
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className={fieldClass(Boolean(errs.notes))}
						/>
					</Field>
					<FieldButtonSlot>
						<Button type="submit" loading={createPayment.isPending} disabled={pendingBalance <= 0}>
							Record payment
						</Button>
					</FieldButtonSlot>
					{willComplete && (
						<FieldButtonSlot>
							<p className="text-xs text-[color:var(--tone-positive-fg)]">
								This payment settles the balance — the tender will move to Collected.
							</p>
						</FieldButtonSlot>
					)}
				</form>
			) : (
				isAdmin && (
					<p className="text-[13px] text-muted-foreground">
						Payments can only be recorded while the tender is for collection.
					</p>
				)
			)}
		</div>
	);
}
