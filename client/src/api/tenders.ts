import { fetchBlob, fetchJson, pageQuery } from "./client";
import type {
	AddTenderProductRequest,
	CreatePaymentRequest,
	CreatePaymentResponse,
	CreateTenderRequest,
	InvoiceTenderRequest,
	Page,
	Payment,
	Tender,
	TenderDetail,
	TenderListItem,
	TenderStatus,
	TenderStatusHistoryRow,
	UpdateTenderRequest,
} from "./types";

export function listTenders(page: number, status?: TenderStatus) {
	return fetchJson<Page<TenderListItem>>(`/api/tenders?${pageQuery(page, { status })}`);
}

export function getTender(id: string) {
	return fetchJson<{ success: true; tender: TenderDetail }>(`/api/tenders/${id}`);
}

export function createTender(payload: CreateTenderRequest) {
	return fetchJson<{ success: true; tender: Tender }>("/api/tenders", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function updateTender(tenderId: string, payload: UpdateTenderRequest) {
	return fetchJson<{ success: true; tender: Tender }>(`/api/tenders/${tenderId}`, {
		method: "PATCH",
		body: JSON.stringify(payload),
	});
}

export function addTenderProduct(tenderId: string, payload: AddTenderProductRequest) {
	return fetchJson<{ success: true }>(`/api/tenders/${tenderId}/products`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function removeTenderProduct(tenderId: string, productId: string) {
	return fetchJson<{ success: true }>(`/api/tenders/${tenderId}/products/${productId}`, {
		method: "DELETE",
	});
}

export function uploadTenderProposal(tenderId: string, file: File) {
	const formData = new FormData();
	formData.append("file", file);
	return fetchJson<{ success: true; tender: Tender }>(`/api/tenders/${tenderId}/proposal`, {
		method: "POST",
		body: formData,
	});
}

export async function downloadTenderProposal(tenderId: string, filename: string) {
	const blob = await fetchBlob(`/api/tenders/${tenderId}/proposal/download`);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function sendTender(tenderId: string) {
	return fetchJson<{ success: true; tender: Tender }>(`/api/tenders/${tenderId}/send`, { method: "POST" });
}

export function finalizeTender(tenderId: string) {
	return fetchJson<{ success: true; tender: Tender }>(`/api/tenders/${tenderId}/finalize`, {
		method: "POST",
	});
}

export function loseTender(tenderId: string) {
	return fetchJson<{ success: true; tender: Tender }>(`/api/tenders/${tenderId}/lost`, { method: "POST" });
}

export function invoiceTender(tenderId: string, payload: InvoiceTenderRequest) {
	return fetchJson<{ success: true; tender: Tender }>(`/api/tenders/${tenderId}/invoice`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export function getTenderHistory(tenderId: string) {
	return fetchJson<{ success: true; history: TenderStatusHistoryRow[] }>(`/api/tenders/${tenderId}/history`);
}

export function listTenderPayments(tenderId: string) {
	return fetchJson<{ success: true; payments: Payment[] }>(`/api/tenders/${tenderId}/payments`);
}

export function createTenderPayment(tenderId: string, payload: CreatePaymentRequest) {
	return fetchJson<CreatePaymentResponse>(`/api/tenders/${tenderId}/payments`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}
