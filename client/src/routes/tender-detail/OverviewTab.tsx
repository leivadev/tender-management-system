import { useState } from "react";
import { BudgetBar } from "../../components/BudgetBar";
import { Button } from "../../components/Button";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../../components/Field";
import {
	useFinalizeTender,
	useInvoiceTender,
	useLoseTender,
	useSendTender,
	useUpdateTender,
} from "../../hooks/useTenders";
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

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		updateTender.mutate(
			{ title: title.trim(), description: description.trim() },
			{
				onSuccess: () => {
					pushToast("Licitación actualizada.");
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
			<Field label="Título" htmlFor="editTitle">
				<input
					id="editTitle"
					required
					minLength={3}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className={inputClass}
				/>
			</Field>
			<Field label="Descripción" htmlFor="editDescription">
				<textarea
					id="editDescription"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className={inputClass}
				/>
			</Field>
			<ErrorMessage error={updateTender.error} />
			<div className="flex gap-2">
				<Button type="submit" loading={updateTender.isPending}>
					Guardar
				</Button>
				<Button type="button" variant="secondary" onClick={onDone}>
					Cancelar
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
	const canSend = tender.status === "draft";
	const canFinalizeOrLose = tender.status === "active";
	const canInvoice = tender.status === "finalized";

	function handleSend() {
		sendTender.mutate(undefined, {
			onSuccess: () => pushToast("Licitación enviada al cliente."),
		});
	}

	function handleFinalize() {
		finalizeTender.mutate(undefined, {
			onSuccess: () => pushToast("Licitación finalizada."),
		});
	}

	function handleLose() {
		if (!confirmAction(`¿Marcar "${tender.title}" como perdida? Esta acción no se puede deshacer.`)) return;
		loseTender.mutate(undefined, {
			onSuccess: () => pushToast("Licitación marcada como perdida."),
		});
	}

	function handleInvoice(e: React.FormEvent) {
		e.preventDefault();
		invoiceTender.mutate(
			{ invoiceAmount: Number(invoiceAmount) },
			{ onSuccess: () => pushToast("Factura registrada.") },
		);
	}

	return (
		<div className="space-y-6">
			{isEditing ? (
				<EditTenderForm onDone={() => setIsEditing(false)} />
			) : (
				<div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
					<div className="sm:col-span-3">
						<p className="text-gray-500">Descripción</p>
						<p>{tender.description || "—"}</p>
					</div>
					<div>
						<p className="text-gray-500">Fecha límite</p>
						<p>{formatDate(tender.deadline)}</p>
					</div>
					<div>
						<p className="text-gray-500">Monto facturado</p>
						<p>{tender.invoiceAmount ? formatCurrency(tender.invoiceAmount) : "—"}</p>
					</div>
					<div className="flex items-end sm:col-start-4 sm:row-start-1 sm:justify-self-end">
						<Button variant="link" onClick={() => setIsEditing(true)}>
							Editar título/descripción
						</Button>
					</div>
				</div>
			)}

			<BudgetBar used={usedBudget} max={Number(tender.maxBudget)} label="Presupuesto usado" />

			<div className="flex flex-wrap items-center gap-3">
				{canSend && (
					<Button
						loading={sendTender.isPending}
						disabled={!tender.proposalKey}
						title={!tender.proposalKey ? "Sube la propuesta antes de enviar" : undefined}
						onClick={handleSend}
					>
						Enviar
					</Button>
				)}
				{canFinalizeOrLose && (
					<>
						<Button variant="info" loading={finalizeTender.isPending} onClick={handleFinalize}>
							Finalizar
						</Button>
						<Button variant="danger" loading={loseTender.isPending} onClick={handleLose}>
							Marcar como perdida
						</Button>
					</>
				)}
				{canInvoice && (
					<form className="flex flex-wrap items-end gap-2" onSubmit={handleInvoice}>
						<Field label="Monto a facturar" htmlFor="invoiceAmount">
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
								Facturar
							</Button>
						</FieldButtonSlot>
					</form>
				)}
			</div>

			{tender.status === "for_collection" && (
				<p className="text-sm text-gray-400">
					Registra los pagos en la pestaña <span className="font-medium">Pagos</span>.
				</p>
			)}
			{(tender.status === "collected" || tender.status === "lost") && (
				<p className="text-sm text-gray-400">Esta licitación está en un estado final.</p>
			)}

			<ErrorMessage
				error={sendTender.error || finalizeTender.error || loseTender.error || invoiceTender.error}
			/>
		</div>
	);
}
