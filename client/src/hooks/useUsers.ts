import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArchivedFilter, CreateUserRequest, UpdateUserRequest } from "../api/types";
import * as api from "../api/users";

export function useUsers(page: number, archived?: ArchivedFilter) {
	return useQuery({
		queryKey: ["users", "list", { page, archived }],
		queryFn: () => api.listUsers(page, archived),
		placeholderData: keepPreviousData,
	});
}

export function useCreateUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateUserRequest) => api.createUser(payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
	});
}

export function useUpdateUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateUserRequest }) => api.updateUser(id, payload),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
	});
}

export function useArchiveUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.archiveUser(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
	});
}

export function useRestoreUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.restoreUser(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "list"] }),
	});
}
