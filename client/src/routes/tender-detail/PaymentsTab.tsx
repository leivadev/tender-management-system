import { useState } from "react";
import { BudgetBar } from "../../components/BudgetBar";
import { Button } from "../../components/Button";
import { Field, FieldButtonSlot } from "../../components/Field";
import { useCreateTenderPayment, useTenderPayments } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { formatCurrency, formatDate } from "../../lib/format";
import { inputClass } from "../../lib/formStyles";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

export function PaymentsTab() {
	const { tender } = useTenderContext();
	const paymentsQuery = useTenderPayments(tender.id);
	const createPayment = useCreateTenderPayment(tender.id);
	const [amount, setAmount] = useState("");
	const [reference, setReference] = useState("");
	const [notes, setNotes] = useState("");

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
			{tender.invoiceAmount && <BudgetBar used={paid} max={invoiceAmount} label="Collected" />}

			<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
				<table className="w-full text-sm">
					<thead className="text-left text-xs text-gray-500">
						<tr>
							<th className="px-4 py-2">Amount</th>
							<th className="px-4 py-2">Reference</th>
							<th className="px-4 py-2">Notes</th>
							<th className="px-4 py-2">Date</th>
						</tr>
					</thead>
					<tbody>
						{(paymentsQuery.data ?? []).map((payment) => (
							<tr key={payment.id} className="border-t border-gray-100 hover:bg-gray-50">
								<td className="px-4 py-2">{formatCurrency(payment.amount)}</td>
								<td className="px-4 py-2">{payment.reference || "—"}</td>
								<td className="px-4 py-2">{payment.notes || "—"}</td>
								<td className="px-4 py-2">{formatDate(payment.paidAt)}</td>
							</tr>
						))}
					</tbody>
				</table>
				{paymentsQuery.data?.length === 0 && (
					<p className="px-4 py-6 text-center text-sm text-gray-500">No payments recorded.</p>
				)}
			</div>

			{canPay ? (
				<form
					onSubmit={handleSubmit}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<Field label={`Amount (balance: ${formatCurrency(pendingBalance)})`} htmlFor="amount">
						<input
							id="amount"
							type="number"
							min="0.01"
							max={pendingBalance || undefined}
							step="0.01"
							required
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className={`w-40 ${inputClass}`}
						/>
					</Field>
					<Field label="Reference" htmlFor="reference">
						<input
							id="reference"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Notes" htmlFor="notes">
						<input
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<FieldButtonSlot>
						<Button type="submit" loading={createPayment.isPending} disabled={pendingBalance <= 0}>
							Record payment
						</Button>
					</FieldButtonSlot>
					{willComplete && (
						<FieldButtonSlot>
							<p className="text-xs text-green-600">
								This payment settles the balance — the tender will move to Collected.
							</p>
						</FieldButtonSlot>
					)}
				</form>
			) : (
				isAdmin && (
					<p className="text-sm text-gray-400">
						Payments can only be recorded while the tender is for collection.
					</p>
				)
			)}
		</div>
	);
}
