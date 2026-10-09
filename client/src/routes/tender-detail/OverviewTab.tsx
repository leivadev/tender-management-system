import { useState } from "react";
import { BudgetBar } from "../../components/BudgetBar";
import { Button } from "../../components/Button";
import { Field, FieldButtonSlot } from "../../components/Field";
import {
	useFinalizeTender,
	useInvoiceTender,
	useLoseTender,
	useSendTender,
	useUpdateTender,
} from "../../hooks/useTenders";
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
		<form
			onSubmit={handleSubmit}
			className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm"
		>
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
	const sendTender = useSendTender(tender.id);
	const finalizeTender = useFinalizeTender(tender.id);
	const loseTender = useLoseTender(tender.id);
	const invoiceTender = useInvoiceTender(tender.id);
	const [invoiceAmount, setInvoiceAmount] = useState("");
	const [isEditing, setIsEditing] = useState(false);

	const usedBudget = tender.products.reduce((sum, p) => sum + Number(p.subtotal), 0);
	const { canWrite, isAdmin } = useAuth();
	const canSend = canWrite && tender.status === "draft";
	const canFinalize = canWrite && tender.status === "active";
	const canLose = isAdmin && tender.status === "active";
	const canInvoice = isAdmin && tender.status === "finalized";

	function handleSend() {
		sendTender.mutate(undefined, {
			onSuccess: () => pushToast("Tender sent to the client."),
		});
	}

	function handleFinalize() {
		finalizeTender.mutate(undefined, {
			onSuccess: () => pushToast("Tender finalized."),
		});
	}

	function handleLose() {
		if (!confirmAction(`Mark "${tender.title}" as lost? This cannot be undone.`)) return;
		loseTender.mutate(undefined, {
			onSuccess: () => pushToast("Tender marked as lost."),
		});
	}

	function handleInvoice(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		invoiceTender.mutate(
			{ invoiceAmount: Number(invoiceAmount) },
			{ onSuccess: () => pushToast("Invoice recorded.") },
		);
	}

	return (
		<div className="space-y-6">
			{isEditing ? (
				<EditTenderForm onDone={() => setIsEditing(false)} />
			) : (
				<div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
					<div className="sm:col-span-3">
						<p className="text-gray-500">Description</p>
						<p>{tender.description || "—"}</p>
					</div>
					<div>
						<p className="text-gray-500">Deadline</p>
						<p>{formatDate(tender.deadline)}</p>
					</div>
					<div>
						<p className="text-gray-500">Invoiced amount</p>
						<p>{tender.invoiceAmount ? formatCurrency(tender.invoiceAmount) : "—"}</p>
					</div>
					{canWrite && (
						<div className="flex items-end sm:col-start-4 sm:row-start-1 sm:justify-self-end">
							<Button variant="link" onClick={() => setIsEditing(true)}>
								Edit title/description
							</Button>
						</div>
					)}
				</div>
			)}

			<BudgetBar used={usedBudget} max={Number(tender.maxBudget)} label="Budget used" />

			<div className="flex flex-wrap items-center gap-3">
				{canSend && (
					<Button
						loading={sendTender.isPending}
						disabled={!tender.proposalKey}
						title={!tender.proposalKey ? "Upload the proposal before sending" : undefined}
						onClick={handleSend}
					>
						Send
					</Button>
				)}
				{canFinalize && (
					<Button variant="info" loading={finalizeTender.isPending} onClick={handleFinalize}>
						Finalize
					</Button>
				)}
				{canLose && (
					<Button variant="danger" loading={loseTender.isPending} onClick={handleLose}>
						Mark as lost
					</Button>
				)}
				{canInvoice && (
					<form className="flex flex-wrap items-end gap-2" onSubmit={handleInvoice}>
						<Field label="Amount to invoice" htmlFor="invoiceAmount">
							<input
								id="invoiceAmount"
								type="number"
								min="0.01"
								step="0.01"
								required
								value={invoiceAmount}
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
				)}
			</div>

			{tender.status === "for_collection" && (
				<p className="text-sm text-gray-400">
					Record payments in the <span className="font-medium">Payments</span> tab.
				</p>
			)}
			{(tender.status === "collected" || tender.status === "lost") && (
				<p className="text-sm text-gray-400">This tender is in a final status.</p>
			)}
		</div>
	);
}
