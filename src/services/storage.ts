import { AppError } from "../lib/errors";

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB (BR-13)
const PDF_MAGIC = new TextEncoder().encode("%PDF-");
const PROPOSAL_CONTENT_TYPE = "application/pdf";

/** The random part is a UUID v4: 122 random bits (SEC-15). */
export function buildProposalKey(tenderId: string) {
	return `proposals/${tenderId}/${crypto.randomUUID()}.pdf`;
}

/** The declared type is client-controlled, so only the content decides (BR-04, SEC-11). */
function startsWithPdfMagic(bytes: Uint8Array) {
	return PDF_MAGIC.every((byte, i) => bytes[i] === byte);
}

/** Validates the file and returns its bytes; stores nothing. */
export async function readProposalFile(file: File) {
	if (file.size > MAX_SIZE_BYTES) {
		throw new AppError(
			"VALIDATION_ERROR",
			`File exceeds the maximum allowed size of ${MAX_SIZE_BYTES} bytes.`,
		);
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!startsWithPdfMagic(bytes)) {
		throw new AppError("VALIDATION_ERROR", "Invalid file: content is not a PDF document.");
	}
	return bytes;
}

export async function storeProposal(env: Env, tenderId: string, filename: string, bytes: Uint8Array) {
	const key = buildProposalKey(tenderId);
	await env.PROPOSALS_R2.put(key, bytes, {
		httpMetadata: { contentType: PROPOSAL_CONTENT_TYPE },
	});

	return {
		key,
		filename,
		contentType: PROPOSAL_CONTENT_TYPE,
		url: `${env.APP_BASE_URL}/api/tenders/${tenderId}/proposal/download`,
	};
}

/** Best effort: an orphaned object is logged, never surfaced to the caller (FR-54). */
export async function deleteProposalQuietly(env: Env, key: string) {
	try {
		await env.PROPOSALS_R2.delete(key);
	} catch (error) {
		console.error(`Failed to delete proposal object ${key}:`, error);
	}
}

export async function getProposalObject(env: Env, key: string) {
	const object = await env.PROPOSALS_R2.get(key);
	if (!object) {
		throw new AppError("NOT_FOUND", "Proposal document not found in storage.");
	}
	return object;
}
