import { useRef, useState } from "react";
import { downloadTenderProposal } from "../../api/tenders";
import { Button } from "../../components/Button";
import { useUploadTenderProposal } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export function ProposalTab() {
	const { tender } = useTenderContext();
	const { canWrite } = useAuth();
	const uploadProposal = useUploadTenderProposal(tender.id);
	const [sizeError, setSizeError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setSizeError(null);
		if (file.type !== "application/pdf") {
			setSizeError("Solo se aceptan archivos PDF.");
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		if (file.size > MAX_SIZE_BYTES) {
			setSizeError("El archivo supera el límite de 15MB.");
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		uploadProposal.mutate(file, {
			onSuccess: () => pushToast("Propuesta subida."),
			onSettled: () => {
				if (fileInputRef.current) fileInputRef.current.value = "";
			},
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
		<div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
			{tender.proposalKey ? (
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm">
						<p className="text-gray-500">Archivo actual</p>
						<p className="font-medium text-gray-900">{tender.proposalFilename}</p>
					</div>
					<Button variant="secondary" loading={downloading} onClick={handleDownload}>
						{downloading ? "Descargando…" : "Descargar"}
					</Button>
				</div>
			) : (
				<p className="text-sm text-gray-500">No se ha subido ninguna propuesta todavía.</p>
			)}

			{canWrite && (
				<div>
					<label htmlFor="proposal-file" className="mb-1 block text-sm text-gray-600">
						{tender.proposalKey ? "Reemplazar archivo (PDF, máx. 15MB)" : "Subir propuesta (PDF, máx. 15MB)"}
					</label>
					<input
						id="proposal-file"
						ref={fileInputRef}
						type="file"
						accept="application/pdf"
						onChange={handleFileChange}
						disabled={uploadProposal.isPending}
						className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
					/>
					{uploadProposal.isPending && <p className="mt-1 text-xs text-gray-400">Subiendo…</p>}
				</div>
			)}

			{sizeError && <p className="text-sm text-red-600">{sizeError}</p>}
		</div>
	);
}
