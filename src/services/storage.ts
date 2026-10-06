import { AppError } from "../lib/errors";

const ALLOWED_CONTENT_TYPES = ["application/pdf"];
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export function buildProposalKey(tenderId: string) {
	return `proposals/${tenderId}/${crypto.randomUUID()}.pdf`;
}

export async function uploadProposal(env: Env, tenderId: string, file: File) {
	if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
		throw new AppError("VALIDATION_ERROR", `Unsupported file type: ${file.type}. Only PDF is allowed.`);
	}
	if (file.size > MAX_SIZE_BYTES) {
		throw new AppError(
			"VALIDATION_ERROR",
			`File exceeds the maximum allowed size of ${MAX_SIZE_BYTES} bytes.`,
		);
	}

	const key = buildProposalKey(tenderId);
	await env.PROPOSALS_R2.put(key, await file.arrayBuffer(), {
		httpMetadata: { contentType: file.type },
	});

	return {
		key,
		filename: file.name,
		contentType: file.type,
		url: `${env.APP_BASE_URL}/api/tenders/${tenderId}/proposal/download`,
	};
}

export async function getProposalObject(env: Env, key: string) {
	const object = await env.PROPOSALS_R2.get(key);
	if (!object) {
		throw new AppError("NOT_FOUND", "Proposal document not found in storage.");
	}
	return object;
}
