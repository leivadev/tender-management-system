import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/tenders";
import type {
	AddTenderProductRequest,
	CreatePaymentRequest,
	CreateTenderRequest,
	InvoiceTenderRequest,
	UpdateTenderRequest,
} from "../api/types";

export function useTenders(page: number, params: api.TenderListParams = {}) {
	return useQuery({
		queryKey: ["tenders", "list", { page, ...params }],
		queryFn: () => api.listTenders(page, params),
		placeholderData: keepPreviousData,
		refetchInterval: 60_000,
	});
}

export function useTender(id: string) {
	return useQuery({
		queryKey: ["tenders", "detail", id],
		queryFn: () => api.getTender(id).then((r) => r.tender),
		enabled: Boolean(id),
		refetchInterval: 60_000,
	});
}

export function useTenderHistory(id: string) {
	return useQuery({
		queryKey: ["tenders", "history", id],
		queryFn: () => api.getTenderHistory(id).then((r) => r.history),
		enabled: Boolean(id),
	});
}

export function useTenderPayments(id: string) {
	return useQuery({
		queryKey: ["tenders", "payments", id],
		queryFn: () => api.listTenderPayments(id).then((r) => r.payments),
		enabled: Boolean(id),
	});
}

function invalidateTenderWrites(queryClient: ReturnType<typeof useQueryClient>, tenderId: string) {
	queryClient.invalidateQueries({ queryKey: ["tenders", "detail", tenderId] });
	queryClient.invalidateQueries({ queryKey: ["tenders", "list"] });
	queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateTender() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateTenderRequest) => api.createTender(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tenders", "list"] });
			queryClient.invalidateQueries({ queryKey: ["dashboard"] });
		},
	});
}

export function useUpdateTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: UpdateTenderRequest) => api.updateTender(tenderId, payload),
		onSuccess: () => invalidateTenderWrites(queryClient, tenderId),
	});
}

export function useAddTenderProduct(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: AddTenderProductRequest) => api.addTenderProduct(tenderId, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenders", "detail", tenderId] }),
	});
}

export function useRemoveTenderProduct(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (productId: string) => api.removeTenderProduct(tenderId, productId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenders", "detail", tenderId] }),
	});
}

export function useUploadTenderProposal(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (file: File) => api.uploadTenderProposal(tenderId, file),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenders", "detail", tenderId] }),
	});
}

export function useSendTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.sendTender(tenderId),
		onSuccess: () => {
			invalidateTenderWrites(queryClient, tenderId);
			queryClient.invalidateQueries({ queryKey: ["tenders", "history", tenderId] });
		},
	});
}

export function useFinalizeTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.finalizeTender(tenderId),
		onSuccess: () => {
			invalidateTenderWrites(queryClient, tenderId);
			queryClient.invalidateQueries({ queryKey: ["tenders", "history", tenderId] });
		},
	});
}

export function useLoseTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.loseTender(tenderId),
		onSuccess: () => {
			invalidateTenderWrites(queryClient, tenderId);
			queryClient.invalidateQueries({ queryKey: ["tenders", "history", tenderId] });
		},
	});
}

export function useInvoiceTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: InvoiceTenderRequest) => api.invoiceTender(tenderId, payload),
		onSuccess: () => {
			invalidateTenderWrites(queryClient, tenderId);
			queryClient.invalidateQueries({ queryKey: ["tenders", "history", tenderId] });
		},
	});
}

export function useCorrectTenderInvoice(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: InvoiceTenderRequest) => api.correctTenderInvoice(tenderId, payload),
		onSuccess: () => invalidateTenderWrites(queryClient, tenderId),
	});
}

export function useArchiveTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.archiveTender(tenderId),
		onSuccess: () => invalidateTenderWrites(queryClient, tenderId),
	});
}

export function useRestoreTender(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => api.restoreTender(tenderId),
		onSuccess: () => invalidateTenderWrites(queryClient, tenderId),
	});
}

export function useCreateTenderPayment(tenderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreatePaymentRequest) => api.createTenderPayment(tenderId, payload),
		onSuccess: () => {
			invalidateTenderWrites(queryClient, tenderId);
			queryClient.invalidateQueries({ queryKey: ["tenders", "payments", tenderId] });
			queryClient.invalidateQueries({ queryKey: ["tenders", "history", tenderId] });
		},
	});
}
