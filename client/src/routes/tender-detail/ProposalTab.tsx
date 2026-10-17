import { Download, FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { downloadTenderProposal } from "../../api/tenders";
import { Button } from "../../components/Button";
import { Card, CardHeader } from "../../components/Card";
import { useUploadTenderProposal } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { cn } from "../../lib/cn";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export function ProposalTab() {
	const { tender } = useTenderContext();
	const { canWrite } = useAuth();
	const uploadProposal = useUploadTenderProposal(tender.id);
	const [fileError, setFileError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [dragging, setDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	function resetInput() {
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function upload(file: File | undefined) {
		if (!file) return;
		setFileError(null);
		if (file.type !== "application/pdf") {
			setFileError("Only PDF files are accepted.");
			resetInput();
			return;
		}
		if (file.size > MAX_SIZE_BYTES) {
			setFileError("The file exceeds the 15MB limit.");
			resetInput();
			return;
		}
		uploadProposal.mutate(file, {
			onSuccess: () => pushToast("Proposal uploaded."),
			onSettled: resetInput,
		});
	}

	async function handleDownload() {
		if (!tender.proposalFilename) return;
		setDownloading(true);
		try {
			await downloadTenderProposal(tender.id, tender.proposalFilename);
		} finally {
			setDownloading(false);
		}
	}

	return (
		<Card className="max-w-2xl">
			<CardHeader title="Proposal" />
			<div className="space-y-4 p-4">
				{tender.proposalKey ? (
					<div className="flex items-center gap-3 rounded-ctl border border-border p-3">
						<div className="grid size-9 shrink-0 place-items-center rounded-ctl bg-primary-soft text-primary">
							<FileText className="size-4" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-[13px] font-medium">{tender.proposalFilename}</p>
							<p className="text-xs text-muted-foreground">PDF</p>
						</div>
						<Button variant="secondary" loading={downloading} onClick={handleDownload}>
							<Download className="size-3.5" aria-hidden="true" />
							{downloading ? "Downloading…" : "Download"}
						</Button>
					</div>
				) : (
					<p className="text-[13px] text-muted-foreground">No proposal has been uploaded yet.</p>
				)}

				{canWrite && !tender.archivedAt && (
					<label
						htmlFor="proposal-file"
						onDragOver={(e) => {
							e.preventDefault();
							setDragging(true);
						}}
						onDragLeave={() => setDragging(false)}
						onDrop={(e) => {
							e.preventDefault();
							setDragging(false);
							upload(e.dataTransfer.files[0]);
						}}
						className={cn(
							"flex cursor-pointer flex-col items-center gap-1.5 rounded-card border border-dashed px-4 py-8 text-center transition-colors",
							dragging ? "border-primary bg-primary-soft" : "border-border hover:bg-muted/50",
							uploadProposal.isPending && "pointer-events-none opacity-60",
						)}
					>
						<Upload className="size-5 text-muted-foreground" aria-hidden="true" />
						<span className="text-[13px] font-medium">
							{uploadProposal.isPending
								? "Uploading…"
								: tender.proposalKey
									? "Replace the file"
									: "Upload the proposal"}
						</span>
						<span className="text-xs text-muted-foreground">
							Drop a PDF here or click to browse. Max 15MB.
						</span>
						<input
							id="proposal-file"
							ref={fileInputRef}
							type="file"
							accept="application/pdf"
							onChange={(e) => upload(e.target.files?.[0])}
							disabled={uploadProposal.isPending}
							className="sr-only"
						/>
					</label>
				)}

				{fileError && (
					<p role="alert" className="text-[13px] text-destructive">
						{fileError}
					</p>
				)}
			</div>
		</Card>
	);
}
