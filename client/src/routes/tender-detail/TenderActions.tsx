import { Archive, ArchiveRestore, CircleCheck, Send, XCircle } from "lucide-react";
import type { TenderDetail, TenderStatus } from "../../api/types";
import { Button } from "../../components/Button";
import {
	useArchiveTender,
	useFinalizeTender,
	useLoseTender,
	useRestoreTender,
	useSendTender,
} from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { confirmAction } from "../../lib/confirm";
import { formatCurrency } from "../../lib/format";
import { pushToast } from "../../lib/toast";

// FR-44: mirrors the server rule; the API stays the authority.
const ARCHIVABLE_STATUSES: TenderStatus[] = ["draft", "collected", "lost"];

/** Status-transition buttons for the page header. Each one confirms before mutating. */
export function TenderActions({ tender }: { tender: TenderDetail }) {
	const { canWrite, isAdmin } = useAuth();
	const sendTender = useSendTender(tender.id);
	const finalizeTender = useFinalizeTender(tender.id);
	const loseTender = useLoseTender(tender.id);
	const archiveTender = useArchiveTender(tender.id);
	const restoreTender = useRestoreTender(tender.id);

	// FR-47: an archived tender is read-only, so only Restore is offered.
	const isArchived = tender.archivedAt !== null;
	const isDraft = tender.status === "draft" && !isArchived;
	const isActive = tender.status === "active" && !isArchived;
	const canArchive = isAdmin && !isArchived && ARCHIVABLE_STATUSES.includes(tender.status);

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

	async function handleArchive() {
		const ok = await confirmAction({
			title: `Archive "${tender.title}"?`,
			description:
				"It will disappear from lists and the dashboard and become read-only. Status, history and proposal are kept. You can restore it later.",
			confirmLabel: "Archive tender",
			destructive: true,
		});
		if (!ok) return;
		archiveTender.mutate(undefined, { onSuccess: () => pushToast("Tender archived.") });
	}

	async function handleRestore() {
		const ok = await confirmAction({
			title: `Restore "${tender.title}"?`,
			description: "It will appear in lists again and become editable.",
			confirmLabel: "Restore tender",
		});
		if (!ok) return;
		restoreTender.mutate(undefined, { onSuccess: () => pushToast("Tender restored.") });
	}

	return (
		<>
			{isDraft && canWrite && (
				<Button
					loading={sendTender.isPending}
					disabled={!tender.proposalKey}
					title={!tender.proposalKey ? "Upload the proposal before sending" : undefined}
					onClick={handleSend}
				>
					<Send className="size-3.5" /> Send
				</Button>
			)}
			{isActive && canWrite && (
				<Button variant="info" loading={finalizeTender.isPending} onClick={handleFinalize}>
					<CircleCheck className="size-3.5" /> Finalize
				</Button>
			)}
			{isActive && isAdmin && (
				<Button variant="danger" loading={loseTender.isPending} onClick={handleLose}>
					<XCircle className="size-3.5" /> Mark as lost
				</Button>
			)}
			{canArchive && (
				<Button variant="ghost" loading={archiveTender.isPending} onClick={handleArchive}>
					<Archive className="size-3.5" /> Archive
				</Button>
			)}
			{isAdmin && isArchived && (
				<Button variant="ghost" loading={restoreTender.isPending} onClick={handleRestore}>
					<ArchiveRestore className="size-3.5" /> Restore
				</Button>
			)}
		</>
	);
}
