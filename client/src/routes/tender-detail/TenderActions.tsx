import { CircleCheck, Lock, Send, XCircle } from "lucide-react";
import type { TenderDetail } from "../../api/types";
import { Button } from "../../components/Button";
import { useFinalizeTender, useLoseTender, useSendTender } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { confirmAction } from "../../lib/confirm";
import { formatCurrency } from "../../lib/format";
import { pushToast } from "../../lib/toast";

/** Status-transition buttons for the page header. Each one confirms before mutating. */
export function TenderActions({ tender }: { tender: TenderDetail }) {
	const { canWrite, isAdmin } = useAuth();
	const sendTender = useSendTender(tender.id);
	const finalizeTender = useFinalizeTender(tender.id);
	const loseTender = useLoseTender(tender.id);

	const isDraft = tender.status === "draft";
	const isActive = tender.status === "active";

	async function handleSend() {
		const ok = await confirmAction({
			title: `Send "${tender.title}" to the client?`,
			description: `The proposal is emailed and the tender becomes active. Budget: ${formatCurrency(tender.maxBudget)}.`,
			confirmLabel: "Send tender",
		});
		if (!ok) return;
		sendTender.mutate(undefined, { onSuccess: () => pushToast("Tender sent to the client.") });
	}

	async function handleFinalize() {
		const ok = await confirmAction({
			title: `Finalize "${tender.title}"?`,
			description: "Products will be locked. You can invoice the tender afterwards.",
			confirmLabel: "Finalize",
		});
		if (!ok) return;
		finalizeTender.mutate(undefined, { onSuccess: () => pushToast("Tender finalized.") });
	}

	async function handleLose() {
		const ok = await confirmAction({
			title: `Mark "${tender.title}" as lost?`,
			description: "This cannot be undone.",
			confirmLabel: "Mark as lost",
			destructive: true,
		});
		if (!ok) return;
		loseTender.mutate(undefined, { onSuccess: () => pushToast("Tender marked as lost.") });
	}

	return (
		<>
			{isDraft &&
				(canWrite ? (
					<Button
						loading={sendTender.isPending}
						disabled={!tender.proposalKey}
						title={!tender.proposalKey ? "Upload the proposal before sending" : undefined}
						onClick={handleSend}
					>
						<Send className="size-3.5" /> Send
					</Button>
				) : (
					<DisabledAction label="Send" reason="Read-only accounts cannot send tenders" />
				))}
			{isActive &&
				(canWrite ? (
					<Button variant="info" loading={finalizeTender.isPending} onClick={handleFinalize}>
						<CircleCheck className="size-3.5" /> Finalize
					</Button>
				) : (
					<DisabledAction label="Finalize" reason="Read-only accounts cannot finalize tenders" />
				))}
			{isActive &&
				(isAdmin ? (
					<Button variant="danger" loading={loseTender.isPending} onClick={handleLose}>
						<XCircle className="size-3.5" /> Mark as lost
					</Button>
				) : (
					<DisabledAction label="Mark as lost" reason="Only administrators can mark a tender as lost" />
				))}
		</>
	);
}

function DisabledAction({ label, reason }: { label: string; reason: string }) {
	return (
		<span title={reason}>
			<Button variant="secondary" disabled>
				<Lock className="size-3.5" /> {label}
			</Button>
		</span>
	);
}
