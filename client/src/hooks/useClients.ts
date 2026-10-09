import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/clients";
import type { CreateClientRequest, UpdateClientRequest } from "../api/types";

export function useClients(page: number) {
	return useQuery({
		queryKey: ["clients", "list", { page }],
		queryFn: () => api.listClients(page),
		placeholderData: keepPreviousData,
	});
}

export function useAllClients() {
	return useQuery({
		queryKey: ["clients", "all"],
		queryFn: () => api.listAllClients(),
	});
}

export function useCreateClient() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateClientRequest) => api.createClient(payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
	});
}

export function useUpdateClient() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateClientRequest }) =>
			api.updateClient(id, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
	});
}
