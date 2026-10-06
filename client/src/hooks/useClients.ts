import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/clients";
import type { CreateClientRequest, UpdateClientRequest } from "../api/types";

export function useClients() {
	return useQuery({
		queryKey: ["clients", "list"],
		queryFn: () => api.listClients().then((r) => r.clients),
	});
}

export function useCreateClient() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateClientRequest) => api.createClient(payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", "list"] }),
	});
}

export function useUpdateClient() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateClientRequest }) =>
			api.updateClient(id, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", "list"] }),
	});
}
